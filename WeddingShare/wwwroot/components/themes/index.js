import { getCookie, setCookie } from '../cookies';

export function initThemes() {
    const theme = getSelectedTheme();

    const themeCookie = getCookie('Theme');
    if (themeCookie === undefined || themeCookie.length === 0 || themeCookie !== theme) {
        changeSelectedTheme(theme);
    }

    bindEventHandlers();
}

export function getSelectedTheme() {
    return document.body.dataset.theme.toLowerCase();
}

export function changeSelectedTheme(theme) {
    setCookie('Theme', theme, 24);
    window.location.reload();
}

function bindEventHandlers() {
    $(document).off('click', '.change-theme').on('click', '.change-theme', function (e) {
        if ($('.change-theme').hasClass('fa-sun')) {
            changeSelectedTheme('default');
        } else {
            changeSelectedTheme('dark');
        }
    });
}