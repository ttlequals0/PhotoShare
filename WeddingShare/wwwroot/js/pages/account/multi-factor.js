import { displayMessage } from '../../../components/message-box';
import { displayPopup } from '../../../components/popups';
import { displayLoader } from '../../../components/loader';

export function initMultiFactor() {
    bindEventHandlers();
}

function bindEventHandlers() {
    $(document).off('click', 'i.btnWipe2FA').on('click', 'i.btnWipe2FA', function (e) {
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