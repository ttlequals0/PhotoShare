import { initReviewConfig } from './review';
import { initGalleryConfig } from './gallery';
import { initUserConfig } from './user';
import { initCustomResourcesConfig } from './custom-resources';
import { initSettingsConfig } from './settings';
import { initAuditConfig } from './audit';
import { initDataConfig } from './data';
import { initMultiFactor } from './multi-factor';

let accountStateCheckInterval = null;

export function initAccountConfig() {
    bindEventHandlers();

    initReviewConfig();
    initGalleryConfig();
    initUserConfig();
    initCustomResourcesConfig();
    initSettingsConfig();
    initAuditConfig();
    initDataConfig();

    initMultiFactor();

    clearInterval(accountStateCheckInterval);
    accountStateCheckInterval = setInterval(function () {
        checkAccountState();
    }, 60000);
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

function checkAccountState() {
    $.ajax({
        url: '/Account/CheckAccountState',
        method: 'GET'
    })
        .done(data => {
            if (data.active !== true) {
                location.href = '/Account/Logout';
            }
        });
}