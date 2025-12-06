import { displayPopup } from '@modules/popups';
import { displayMessage } from '@modules/message-box';
import { displayLoader } from '@modules/loader';

function init() {
    bindEventHandlers();
}

function bindEventHandlers() {
    bindMultiFactorChangeButton();
    bindMultiFactorWipeButton();
}

function bindMultiFactorChangeButton() {
    $(document).off('click', '.change-2fa').on('click', '.change-2fa', function (e) {
        preventDefaults(e);
        multiFactorAuthSetup($('.change-2fa').data('mfa-set'));
    });
}

function bindMultiFactorWipeButton() {
    $(document).off('click', '.btnWipe2FA').on('click', '.btnWipe2FA', function (e) {
        preventDefaults(e);

        if ($(this).attr('disabled') == 'disabled') {
            return;
        }

        let row = $(this).closest('tr');
        displayPopup({
            Title: localization.translate('2FA_Setup'),
            Message: localization.translate('2FA_Wipe_Message', { name: row.data('user-name') }),
            Fields: [{
                Id: 'user-id',
                Value: row.data('user-id'),
                Type: 'hidden'
            }],
            Buttons: [{
                Text: localization.translate('Wipe'),
                Class: 'btn-danger',
                Callback: function () {
                    displayLoader(localization.translate('Loading'));

                    let id = $('#popup-modal-field-user-id').val();
                    if (id == undefined || id.length == 0) {
                        displayMessage(localization.translate('2FA_Setup'), localization.translate('User_Missing_Id'));
                        return;
                    }

                    $.ajax({
                        url: '/Account/ResetMultifactorAuthForUser',
                        method: 'DELETE',
                        data: { userId: id }
                    })
                        .done(data => {
                            if (data.success === true) {
                                updatePage();
                                displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Wipe'));
                            } else if (data.message) {
                                displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'), [data.message]);
                            } else {
                                displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'));
                            }
                        })
                        .fail((xhr, error) => {
                            displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'), [error]);
                        });
                }
            }, {
                Text: localization.translate('Close')
            }]
        });
    });
}

function multiFactorAuthSetup(showResetOption) {
    let customHtml = '';
    let buttons = [];

    if (showResetOption) {
        buttons = [{
            Text: localization.translate('Reset'),
            Class: 'btn-danger',
            Callback: function () {
                $.ajax({
                    type: "DELETE",
                    url: '/Account/ResetMultifactorAuth',
                    success: function (data) {
                        if (data.success) {
                            displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Reset_Successfully'));
                        } else {
                            displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Reset_Failed'));
                        }
                        $('i.change-2fa').attr('data-mfa-set', data.success);
                    }
                });
            }
        }, {
            Text: localization.translate('Close')
        }];
    } else {
        customHtml = `<div class="text-center">
            <p class="mb-1">${localization.translate('2FA_Scan_With_App')}</p>
            <p class="mb-2"><img src="@qrCode"/></p>
            <p class="mb-2">${localization.translate('Or')}</p>
            <p class="mb-0">${localization.translate('2FA_Manually_Enter_Code')}</p>
            <p class="mb-4 fw-bold">@secret</p>
        </div>`;

        buttons = [{
            Text: localization.translate('Next'),
            Class: 'btn-success',
            Callback: function () {
                multiFactorAuthValidation();
            }
        }, {
            Text: localization.translate('Close')
        }];
    }

    displayPopup({
        Title: localization.translate('2FA_Setup'),
        CustomHtml: customHtml,
        Buttons: buttons
    });
}
function multiFactorAuthValidation() {
    displayPopup({
        Title: localization.translate('2FA_Setup'),
        Fields: [{
            Id: '2fa-secret',
            Value: '@secret',
            Type: 'hidden'
        }, {
            Id: '2fa-code',
            Name: localization.translate('Code'),
            Value: '',
            Hint: localization.translate('2FA_Code_Hint')
        }],
        Buttons: [{
            Text: localization.translate('Validate'),
            Class: 'btn-success',
            Callback: function () {
                let secret = $('#popup-modal-field-2fa-secret').val();
                let code = $('#popup-modal-field-2fa-code').val();

                $.ajax({
                    type: "POST",
                    url: '/Account/RegisterMultifactorAuth',
                    data: { secret, code },
                    success: function (data) {
                        if (data.success) {
                            displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Successfully'));
                        } else {
                            displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'));
                        }
                        $('i.change-2fa').attr('data-mfa-set', data.success);
                    }
                });
            }
        }, {
            Text: localization.translate('Close')
        }]
    });
}

export default init;