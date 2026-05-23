import { displayMessage } from '@modules/message-box';
import { displayPopup } from '@modules/popups';

// Module-level guard so init() running more than once in the SAME page
// lifecycle (partial JS re-eval, SW returning cached HTML to a tab that
// already started rendering, etc.) doesn't fire the page-load prompt
// twice. Resets naturally on real navigation since the module is re-
// evaluated. This is intentionally NOT sessionStorage - we want the
// prompt to come back on the next page load if the user hasn't set
// an identity yet.
let pageLoadPromptFired = false;

function init() {
    bindEventHandlers();

    // Skip auto-prompt when an upload form is on the page - the upload flow
    // triggers a required prompt the first time the user clicks upload, and
    // firing both produces the double-prompt experience.
    const pageLoadEnabled = $('body').data('identity-check');
    const hasUploadForm = $('form.file-uploader-form').length > 0;
    if (!pageLoadEnabled || hasUploadForm) return;

    if (pageLoadPromptFired) return;
    pageLoadPromptFired = true;

    // Honour the server-side "require identity for upload" setting: when
    // true, the prompt is non-dismissable (no Stay Anonymous button), so
    // operators who configured Identity.RequireIdentityForUpload get the
    // strict behaviour they asked for. When false, the prompt is a
    // friendly proactive ask with a Stay Anonymous escape hatch.
    const required = $('body').data('identity-required') === true;
    displayIdentityCheck(required);
}

function bindEventHandlers() {
    bindChangeIdentityButton();
}

function bindChangeIdentityButton() {
    $(document).off('click', '.change-identity').on('click', '.change-identity', function (e) {
        preventDefaults(e);
        displayIdentityCheckChangeIdentity($(this));
    });
}

export function displayIdentityCheck(required, callbackFn) {
    let buttons = [{
        Text: localization.translate('Identity_Check_Tell_Us'),
        Class: 'btn-primary-2',
        Callback: function () {
            let name = $('#popup-modal-field-identity-name').val().trim();
            let emailAddress = $('#popup-modal-field-identity-email').length > 0 ? $('#popup-modal-field-identity-email').val().trim() : '';
            if (name !== undefined && name.length > 0) {
                $.ajax({
                    url: '/Home/SetIdentity',
                    method: 'POST',
                    data: { name, emailAddress }
                })
                    .done(data => {
                        if (data == undefined || data.success == undefined) {
                            displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                        } else if (data.success) {
                            $('.file-uploader-form').attr('data-identity-required', 'false');

                            if (callbackFn !== undefined && callbackFn !== null) {
                                callbackFn();
                            } else {
                                window.location.reload();
                            }
                        } else if (data.reason == 1) {
                            displayMessage(localization.translate('Identity_Check_Invalid_Name'), localization.translate('Identity_Check_Invalid_Name_Msg'), null, () => {
                                displayIdentityCheck(required, callbackFn);
                            });
                        } else if (data.reason == 2) {
                            displayMessage(localization.translate('Identity_Check_Invalid_Email'), localization.translate('Identity_Check_Invalid_Email_Msg'), null, () => {
                                displayIdentityCheck(required, callbackFn);
                            });
                        } else {
                            displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                        }
                    })
                    .fail((xhr, error) => {
                        displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                    });
            } else {
                displayMessage(localization.translate('Identity_Check_Invalid_Name'), localization.translate('Identity_Check_Invalid_Name_Msg'), null, () => {
                    displayIdentityCheck(required, callbackFn);
                });
            }
        }
    }];

    if (!required) {
        buttons.push({
            Text: localization.translate('Identity_Check_Stay_Anonymous'),
            Callback: function () {
                $.ajax({
                    url: '/Home/SetIdentity',
                    method: 'POST',
                    data: { name: 'Anonymous', emailAddress: '' }
                })
                    .done(data => {
                        if (data == undefined || data.success == undefined) {
                            displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                        } else if (data.success) {
                            window.location.reload();
                        } else if (data.reason == 1) {
                            displayMessage(localization.translate('Identity_Check_Invalid_Name'), localization.translate('Identity_Check_Invalid_Name_Msg'), null, () => {
                                displayIdentityCheck(required, callbackFn);
                            });
                        } else if (data.reason == 2) {
                            displayMessage(localization.translate('Identity_Check_Invalid_Email'), localization.translate('Identity_Check_Invalid_Email_Msg'), null, () => {
                                displayIdentityCheck(required, callbackFn);
                            });
                        } else {
                            displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                        }
                    })
                    .fail((xhr, error) => {
                        displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                    });
            }
        });
    }

    let emailRequired = $('.change-identity').attr('data-identity-email') !== undefined;
    let identityCheckFields = [{
        Id: 'identity-name',
        Name: localization.translate('Identity_Check_Name'),
        Value: '',
        Hint: localization.translate('Identity_Check_Name_Hint'),
        Placeholder: localization.translate('Identity_Check_Name_Placeholder')
    }];

    if (emailRequired) {
        identityCheckFields.push({
            Id: 'identity-email',
            Name: localization.translate('Identity_Check_Email'),
            Value: '',
            Hint: localization.translate('Identity_Check_Email_Hint'),
            Placeholder: localization.translate('Identity_Check_Email_Placeholder')
        });
    }

    displayPopup({
        Title: localization.translate('Identity_Check'),
        Fields: identityCheckFields,
        Buttons: buttons
    });
}

function displayIdentityCheckChangeIdentity(elem) {
    let emailRequired = elem.attr('data-identity-email') !== undefined;

    let fields = [{
        Id: 'identity-name',
        Name: localization.translate('Identity_Check_Name'),
        Value: elem.data('identity-name'),
        Hint: localization.translate('Identity_Check_Name_Hint'),
        Placeholder: localization.translate('Identity_Check_Name_Placeholder')
    }];

    if (emailRequired) {
        fields.push({
            Id: 'identity-email',
            Name: localization.translate('Identity_Check_Email'),
            Value: elem.data('identity-email'),
            Hint: localization.translate('Identity_Check_Email_Hint'),
            Placeholder: localization.translate('Identity_Check_Email_Placeholder')
        });
    }

    displayPopup({
        Title: localization.translate('Identity_Check_Change_Identity'),
        Fields: fields,
        Buttons: [{
            Text: localization.translate('Identity_Check_Change'),
            Class: 'btn-primary-2',
            Callback: function () {
                let name = $('#popup-modal-field-identity-name').val().trim();
                let emailAddress = $('#popup-modal-field-identity-email').length > 0 ? $('#popup-modal-field-identity-email').val().trim() : '';
                if (name !== undefined && name.length > 0) {
                    $.ajax({
                        url: '/Home/SetIdentity',
                        method: 'POST',
                        data: { name, emailAddress }
                    })
                        .done(data => {
                            if (data == undefined || data.success == undefined) {
                                displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                            } else if (data.success) {
                                window.location.reload();
                            } else if (data.reason == 1) {
                                displayMessage(localization.translate('Identity_Check_Invalid_Name'), localization.translate('Identity_Check_Invalid_Name_Msg'), null, () => {
                                    displayIdentityCheckChangeIdentity(elem);
                                });
                            } else if (data.reason == 2) {
                                displayMessage(localization.translate('Identity_Check_Invalid_Email'), localization.translate('Identity_Check_Invalid_Email_Msg'), null, () => {
                                    displayIdentityCheckChangeIdentity(elem);
                                });
                            } else {
                                displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                            }
                        })
                        .fail((xhr, error) => {
                            displayMessage(localization.translate('Identity_Check'), localization.translate('Identity_Check_Set_Failed'), [error]);
                        });
                } else {
                    displayMessage(localization.translate('Identity_Check_Invalid_Name'), localization.translate('Identity_Check_Invalid_Name_Msg'), null, () => {
                        displayIdentityCheckChangeIdentity(elem);
                    });
                }
            }
        }, {
            Text: localization.translate('Cancel')
        }]
    });
}

export default init;