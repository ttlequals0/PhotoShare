import '@modules/loader/jquery.loading.min.js';
import './loader.css';

function init() {
    bindEventHandlers();
}

function bindEventHandlers() {
    bindEscapeKey();
    bindReloadButton();
}

function bindEscapeKey() {
    $(document).on('keyup', (e) => {
        if (e.key === 'Escape') {
            hideLoader();
        }
    });
}

function bindReloadButton() {
    $(document).on('click', '.btn-reload', () => {
        hideLoader();
    });
}

export function displayLoader(message) {
    $('body').loading({
        theme: 'dark',
        message,
        stoppable: false,
        start: true
    });
}

export function hideLoader() {
    $('body').loading('stop');
}

init();