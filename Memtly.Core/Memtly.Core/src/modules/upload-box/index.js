import Resumable from 'resumablejs';
import { displayMessage } from '@modules/message-box';
import { displayLoader, hideLoader } from '@modules/loader';
import { displayIdentityCheck } from '@modules/identity-check';
import { refreshGalleryPage } from '@pages/gallery/gallery';

class UploadBox {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 2000;
    }

    init() {
        this.initializeDropZones();
    }

    isIdentityRequired() {
        return $('form.file-uploader-form').attr('data-identity-required') === 'true';
    }

    triggerSelector(event) {
        if (this.isIdentityRequired()) {
            displayIdentityCheck(true, () => {
                this.triggerSelector(event);
            });
            return;
        }

        const zone = event.target.closest('fieldset.upload_drop');
        const input = $(zone.querySelector('input.upload-input'));

        // Always defer to the OS file picker. On iOS / Android, accept=image/*,video/*
        // already exposes Photo Library / Take Photo or Video / Choose Files as native
        // chooser entries, so the custom "Gallery vs Camera" modal we used to show was
        // a redundant second prompt. Desktop browsers get the file dialog directly.
        this.setGalleryMode(input);
        input[0].click();
    }

    setGalleryMode(input) {
        input.attr('accept', 'image/*,video/*');
        input.attr('multiple', '');
        input.removeAttr('capture');
    }

    highlight(e) {
        $(e.target).closest('.upload_drop').addClass('highlight');
    }

    unhighlight(e) {
        $(e.target).closest('.upload_drop').removeClass('highlight');
    }

    getInputAndGalleryRefs(element) {
        const zone = element.closest('fieldset.upload_drop') || false;
        const gallery = zone ? zone.querySelector('.upload_gallery') : false;
        const input = zone ? zone.querySelector('input[type="file"]') : false;
        return { input, gallery };
    }

    handleDrop(event) {
        const dataRefs = this.getInputAndGalleryRefs(event.target);
        dataRefs.files = event.dataTransfer.files;

        if (this.isIdentityRequired()) {
            displayIdentityCheck(true, () => {
                this.handleFiles(dataRefs);
            });
        } else {
            this.handleFiles(dataRefs);
        }
    }

    initializeDropZones() {
        const dropZones = document.querySelectorAll('fieldset.upload_drop');

        dropZones.forEach(zone => {
            this.setupEventHandlers(zone);
        });
    }

    setupEventHandlers(zone) {
        const dataRefs = this.getInputAndGalleryRefs(zone);

        if (!dataRefs.input) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Open file browser on drop area click
        ['click', 'touch'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => this.triggerSelector(e), false);
        });

        // Highlighting drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => this.highlight(e), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => this.unhighlight(e), false);
        });

        // Handle dropped files
        zone.addEventListener('drop', (e) => this.handleDrop(e), false);

        // Handle browse selected files
        dataRefs.input.addEventListener('change', (event) => {
            dataRefs.files = event.target.files;
            this.handleFiles(dataRefs);
        }, false);
    }

    isImageFile(file) {
        return file.type.toLowerCase().startsWith('image/');
    }

    isVideoFile(file) {
        return file.type.toLowerCase().startsWith('video/');
    }

    async handleFiles(dataRefs) {
        let files = [...dataRefs.files];

        // Extension match against the server's Allowed_File_Types setting,
        // exposed as a data-attribute on the input. We do this client-side
        // BEFORE uploading because Cloudflare Tunnel + chunked uploads mean
        // an unsupported .mkv could push hundreds of MB before the server
        // rejects it at ingest. Fall back to the upstream MIME-prefix check
        // if the attribute is missing (older view, no list available).
        const allowedRaw = (dataRefs.input.getAttribute('data-allowed-file-types') || '').trim();
        const rejected = [];

        if (allowedRaw.length > 0) {
            const allowedExts = allowedRaw.split(',')
                .map(s => s.trim().toLowerCase().replace(/^\./, ''))
                .filter(Boolean);

            files = files.filter(item => {
                const ext = (item.name.split('.').pop() || '').toLowerCase();
                if (allowedExts.includes(ext)) return true;
                rejected.push(`${item.name}: .${ext}`);
                return false;
            });
        } else {
            files = files.filter(item => {
                const allowed = this.isImageFile(item) || this.isVideoFile(item);
                if (!allowed) rejected.push(`${item.name}: ${item.type || 'unknown'}`);
                return allowed;
            });
        }

        if (rejected.length > 0) {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Invalid_File_Type'),
                rejected
            );
        }

        if (!files.length) return;

        dataRefs.files = files;
        await this.imageUpload(dataRefs);
    }

    async imageUpload(dataRefs) {
        if (this.isIdentityRequired()) {
            displayIdentityCheck(true, () => {
                dataRefs.input.click();
            });
            return;
        }

        // Multiple source routes, so double check validity
        if (!dataRefs.files || !dataRefs.input) {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Upload_No_Files_Detected')
            );
            return;
        }

        const token = $('form.file-uploader-form input[name=\'__RequestVerificationToken\']').val();
        const galleryId = dataRefs.input.getAttribute('data-post-gallery-id');
        const url = dataRefs.input.getAttribute('data-post-url');
        const secretKey = dataRefs.input.getAttribute('data-post-key');

        if (!galleryId) {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Upload_Invalid_Gallery_Detected')
            );
            return;
        }

        if (!url) {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Upload_Invalid_Upload_Url')
            );
            return;
        }

        // Chunked upload via Resumable.js. 25 MB chunks keep individual
        // POSTs well under Cloudflare Tunnel's 100 MB body cap (free tier)
        // and let the server reassemble large iOS videos in /app/temp.
        let uploadedCount = 0;
        let requiresReview = true;
        const errors = [];

        const r = new Resumable({
            target: '/Gallery/UploadChunk',
            chunkSize: 25 * 1024 * 1024,
            simultaneousUploads: 3,
            testChunks: true,
            maxChunkRetries: this.maxRetries,
            chunkRetryInterval: this.retryDelay,
            forceChunkSize: false,
            query: {
                resumableGalleryId: galleryId,
                resumableSecretKey: secretKey ?? '',
            },
            // Antiforgery token is read on every chunk POST so a rotated
            // token after the first chunk still authenticates.
            headers: () => ({
                'RequestVerificationToken': $('form.file-uploader-form input[name=\'__RequestVerificationToken\']').val()
            }),
        });

        r.on('fileSuccess', (file, message) => {
            try {
                const resp = JSON.parse(message || '{}');
                if (resp.success) {
                    uploadedCount++;
                    if (typeof resp.requiresReview === 'boolean') {
                        requiresReview = resp.requiresReview;
                    }
                } else if (Array.isArray(resp.errors)) {
                    errors.push(...resp.errors);
                }
            } catch {
                // Non-JSON success body - rare. Count the file as uploaded.
                uploadedCount++;
            }
        });

        r.on('fileError', (file, message) => {
            errors.push(`${localization.translate('Upload_Failed')}: ${file.fileName}`);
            console.error('Resumable fileError', file.fileName, message);
        });

        r.on('progress', () => {
            const pct = Math.floor(r.progress() * 100);
            const el = $('span#file-upload-progress');
            if (el.length) el.text(`${pct}%`);
        });

        r.on('complete', () => {
            this.handleUploadComplete(uploadedCount, requiresReview, errors, galleryId, secretKey, dataRefs);
        });

        // Resumable.js's bootstrap (chunk creation) is async via setTimeout(0)
        // and so is the fileAdded event. If we call r.upload() synchronously
        // after r.addFile(f), the file has no chunks yet, upload() sees
        // nothing to send, and fires 'complete' immediately with 0 uploaded
        // - producing "There was an issue uploading some files" before any
        // network traffic. Call upload() from the fileAdded handler instead;
        // by then bootstrap has run and the chunks array is populated.
        r.on('fileAdded', () => r.upload());

        displayLoader(
            `${localization.translate('Upload_Progress')}...<br/><br/><span id="file-upload-progress">0%</span>`
        );

        for (const f of dataRefs.files) {
            r.addFile(f);
        }
    }

    handleUploadComplete(uploadedCount, requiresReview, errors, galleryId, secretKey, dataRefs) {
        hideLoader();

        if (uploadedCount <= 0) {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Upload_Failed'),
                errors
            );
        } else if (requiresReview) {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Upload_Success_Pending_Review'),
                errors
            );

            this.notifyUploadCompleted(galleryId, secretKey, uploadedCount, dataRefs);
        } else {
            displayMessage(
                localization.translate('Upload'),
                localization.translate('Upload_Success'),
                errors,
                () => refreshGalleryPage()
            );
        }
    }

    notifyUploadCompleted(galleryId, secretKey, uploadedCount, dataRefs) {
        const formData = new FormData();
        formData.append('Id', galleryId);
        formData.append('SecretKey', secretKey);
        formData.append('Count', uploadedCount);

        setTimeout(() => {
            $.ajax({
                url: '/Gallery/UploadCompleted',
                type: 'POST',
                data: formData,
                async: true,
                cache: false,
                contentType: false,
                dataType: 'json',
                processData: false,
                success: (response) => {
                    dataRefs.input.value = '';

                    const counter = $('.review-counter');
                    if (counter.length > 0) {
                        counter.find('.review-counter-total').text(response.counters.total);
                        counter.find('.review-counter-approved').text(response.counters.approved);
                        counter.find('.review-counter-pending').text(response.counters.pending);
                    }
                },
                error: (response) => {
                    console.error(response);
                    displayMessage(
                        localization.translate('Upload'),
                        localization.translate('Upload_Failed'),
                        [response]
                    );
                }
            });
        }, 500);
    }
}

const galleryUpload = new UploadBox();

export default galleryUpload;