import { initReviewConfig } from './review';
import { initGalleryConfig } from './gallery';
import { initCustomResourcesConfig } from './custom-resources';

export function initAccountConfig() {
    bindEventHandlers();

    initReviewConfig();
    initGalleryConfig();
    initCustomResourcesConfig();
}

function bindEventHandlers() {
    $(document).off('click', 'a.pnl-selector').on('click', 'a.pnl-selector', function (e) {
        preventDefaults(e);

        let tab = $(this).data('tab');
        selectActiveTab(tab);
    });
}

function selectActiveTab(tab) {
    if (tab === undefined || tab === null || tab.length === 0) {
        tab = $('a.pnl-selector')[0].attributes['data-tab'].value;
    }

    window.location = `/Account?tab=${tab}`;
}