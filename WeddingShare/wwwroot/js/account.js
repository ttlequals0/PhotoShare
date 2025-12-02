import '../components/validation/password-validation';

//let accountStateCheckInterval = null;
//let auditSearchTimeout = null;

//function updateUsersList() {
//    $.ajax({
//        type: 'GET',
//        url: `/Account/UsersList`,
//        success: function (data) {
//            $('#users-list').html(data);
//        }
//    });
//}

//function updateSettings() {
//    $.ajax({
//        type: 'GET',
//        url: `/Account/SettingsPartial`,
//        success: function (data) {
//            $('#settings-list').html(data);
//        }
//    });
//}

//function updateAuditList(term = '', limit = 100) {
//    clearTimeout(auditSearchTimeout);
//    auditSearchTimeout = setTimeout(function () {
//        $.ajax({
//            type: 'POST',
//            url: `/Account/AuditList`,
//            data: { term: term?.trim(), limit: limit },
//            success: function (data) {
//                $('#audit-list').html(data);
//            }
//        });
//    }, 500);
//}

//function updatePage() {
//    updateUsersList();
//    updateGalleryList();
//    updatePendingReviews();
//    updateCustomResources();
//    updateSettings();
//    updateAuditList();
//}

//function checkAccountState() {
//    $.ajax({
//        url: '/Account/CheckAccountState',
//        method: 'GET'
//    })
//        .done(data => {
//            if (data.active !== true) {
//                location.href = '/Account/Logout';
//            }
//        });
//}



//(function () {
//    document.addEventListener('DOMContentLoaded', function () {

//        clearInterval(accountStateCheckInterval);
//        accountStateCheckInterval = setInterval(function () {
//            checkAccountState();
//        }, 60000);



//        $(document).off('change', 'input.setting-field,select.setting-field,textarea.setting-field').on('change', 'input.setting-field,select.setting-field,textarea.setting-field', function (e) {
//            $(this).attr('data-updated', 'true');
//        });

//        $(document).off('click', 'button#btnSaveSettings').on('click', 'button#btnSaveSettings', function (e) {
//            let updatedFields = $('.setting-field[data-updated="true"]');
//            if (updatedFields.length > 0) {
//                var settingsList = $.map(updatedFields, function (item) {
//                    let element = $(item);
//                    return { key: element.data('setting-name'), value: element.val() };
//                });

//                displayLoader(localization.translate('Loading'));
//                $.ajax({
//                    url: '/Account/UpdateSettings',
//                    method: 'PUT',
//                    data: { model: settingsList }
//                })
//                    .done(data => {
//                        if (data.success === true) {
//                            displayMessage(localization.translate('Update_Settings'), localization.translate('Update_Settings_Success'));
//                        } else if (data.message) {
//                            displayMessage(localization.translate('Update_Settings'), localization.translate('Update_Settings_Failed'), [data.message]);
//                        } else {
//                            displayMessage(localization.translate('Update_Settings'), localization.translate('Update_Settings_Failed'));
//                        }
//                    })
//                    .fail((xhr, error) => {
//                        displayMessage(localization.translate('Update_Settings'), localization.translate('Update_Settings_Failed'), [error]);
//                    });
//            } else {
//                displayMessage(localization.translate('Update_Settings'), localization.translate('Update_Settings_No_Change'));
//            }
//        });





//        $(document).off('click', 'i.btnAddUser').on('click', 'i.btnAddUser', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            displayPopup({
//                Title: localization.translate('User_Create'),
//                Fields: [{
//                    Id: 'user-name',
//                    Name: localization.translate('User_Name'),
//                    Hint: localization.translate('User_Name_Hint')
//                },
//                {
//                    Id: 'user-email',
//                    Name: localization.translate('User_Email'),
//                    Hint: localization.translate('User_Email_Hint')
//                },
//                {
//                    Id: 'user-password',
//                    Name: localization.translate('User_Password'),
//                    Hint: localization.translate('User_Password_Hint'),
//                    Type: "password"
//                },
//                {
//                    Id: 'user-cpassword',
//                    Name: localization.translate('User_Confirm_Password'),
//                    Hint: localization.translate('User_Confirm_Password_Hint'),
//                    Type: "password",
//                    Class: 'confirm-password'
//                },
//                {
//                    Id: 'user-level',
//                    Name: localization.translate('User_Level'),
//                    Hint: localization.translate('User_Level_Hint'),
//                    Type: 'select',
//                    SelectOptions: [
//                        {
//                            key: '0',
//                            selected: true,
//                            value: 'Free'
//                        },
//                        {
//                            key: '1',
//                            selected: false,
//                            value: 'Paid'
//                        },
//                        {
//                            key: '2',
//                            selected: false,
//                            value: 'Reviewer'
//                        },
//                        {
//                            key: '3',
//                            selected: false,
//                            value: 'Moderator'
//                        },
//                        {
//                            key: '4',
//                            selected: false,
//                            value: 'Admin'
//                        }
//                    ]
//                }],
//                FooterHtml: `${generatePasswordValidation('input#popup-modal-field-user-password')}<script>initPasswordValidation();</script>`,
//                Buttons: [{
//                    Text: localization.translate('Add'),
//                    Class: 'btn-success',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let username = $('#popup-modal-field-user-name').val();
//                        if (username == undefined || username.length == 0) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Missing_Name'));
//                            return;
//                        }

//                        const usernameRegex = /^[a-zA-Z0-9\-\s-_~]+$/;
//                        if (!usernameRegex.test(username)) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_Name'));
//                            return;
//                        }

//                        let email = $('#popup-modal-field-user-email').val();
//                        const emailRegex = /^((?!\.)[\w\-_.]*[^.])(@[\w\-_]+)(\.\w+(\.\w+)?[^.\W])$/;
//                        if (email != undefined && email.length > 0 && !emailRegex.test(email)) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_Email'));
//                            return;
//                        }

//                        let password = $('#popup-modal-field-user-password').val();
//                        if (password == undefined || password.length < 8) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_Password'));
//                            return;
//                        }

//                        let cpassword = $('#popup-modal-field-user-cpassword').val();
//                        if (password !== cpassword) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_CPassword'));
//                            return;
//                        }

//                        let level = $('#popup-modal-field-user-level').val();
//                        if (level == undefined || level.length == 0) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_Level'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/AddUser',
//                            method: 'POST',
//                            data: { Username: username, Email: email, Password: password, CPassword: cpassword, Level: level }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updateUsersList();
//                                    displayMessage(localization.translate('User_Create'), localization.translate('User_Create_Success'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('User_Create'), localization.translate('User_Create_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('User_Create'), localization.translate('User_Create_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('User_Create'), localization.translate('User_Create_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });





//        $(document).off('click', 'i.btnImport').on('click', 'i.btnImport', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            displayPopup({
//                Title: localization.translate('Import_Data'),
//                Fields: [{
//                    Id: 'import-file',
//                    Name: localization.translate('Import_Data_Backup_File'),
//                    Type: 'File',
//                    Hint: localization.translate('Import_Data_Backup_Hint'),
//                    Accept: '.zip'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Import'),
//                    Class: 'btn-success',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        var files = $('#popup-modal-field-import-file')[0].files;
//                        if (files == undefined || files.length == 0) {
//                            displayMessage(localization.translate('Import_Data'), localization.translate('Import_Data_Select_File'));
//                            return;
//                        }

//                        var data = new FormData();
//                        data.append('file-0', files[0]);

//                        $.ajax({
//                            url: '/Account/ImportBackup',
//                            method: 'POST',
//                            data: data,
//                            contentType: false,
//                            processData: false
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    displayMessage(localization.translate('Import_Data'), localization.translate('Import_Data_Success'));
//                                    window.location.reload();
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('Import_Data'), localization.translate('Import_Data_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('Import_Data'), localization.translate('Import_Data_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('Import_Data'), localization.translate('Import_Data_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });

//        $(document).off('click', 'i.btnExport').on('click', 'i.btnExport', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            displayPopup({
//                Title: localization.translate('Export_Data'),
//                Fields: [{
//                    Id: 'database',
//                    Type: 'checkbox',
//                    Checked: true,
//                    Class: 'form-check-input',
//                    Label: 'Database'
//                }, {
//                    Id: 'uploads',
//                    Type: 'checkbox',
//                    Checked: true,
//                    Class: 'form-check-input',
//                    Label: 'Uploads'
//                }, {
//                    Id: 'thumbnails',
//                    Type: 'checkbox',
//                    Checked: true,
//                    Class: 'form-check-input',
//                    Label: 'Thumbnails'
//                }, {
//                    Id: 'custom-resources',
//                    Type: 'checkbox',
//                    Checked: true,
//                    Class: 'form-check-input',
//                    Label: 'Custom Resources'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Export'),
//                    Class: 'btn-success',
//                    Callback: function () {
//                        displayLoader(localization.translate('Generating_Download'));

//                        $.ajax({
//                            url: '/Account/ExportBackup',
//                            method: 'POST',
//                            data: {
//                                Database: $('#popup-modal-field-database').is(':checked'),
//                                Uploads: $('#popup-modal-field-uploads').is(':checked'),
//                                Thumbnails: $('#popup-modal-field-thumbnails').is(':checked'),
//                                CustomResources: $('#popup-modal-field-custom-resources').is(':checked')
//                            },
//                            xhrFields: {
//                                responseType: 'blob'
//                            }
//                        })
//                            .done((data, status, xhr) => {
//                                hideLoader();

//                                try {
//                                    downloadBlob(`WeddingShare_${getTimestamp()}.zip`, 'application/zip', data, xhr);
//                                } catch {
//                                    displayMessage(localization.translate('Export_Data'), localization.translate('Export_Data_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('Export_Data'), localization.translate('Export_Data_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });



//        $(document).off('click', 'i.btnWipe2FA').on('click', 'i.btnWipe2FA', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            displayPopup({
//                Title: localization.translate('2FA_Setup'),
//                Message: localization.translate('2FA_Wipe_Message', { name: row.data('user-name') }),
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Wipe'),
//                    Class: 'btn-danger',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('2FA_Setup'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/ResetMultifactorAuthForUser',
//                            method: 'DELETE',
//                            data: { userId: id }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updatePage();
//                                    displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Wipe'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('2FA_Setup'), localization.translate('2FA_Set_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });

//        $(document).off('click', 'i.btnFreezeUser').on('click', 'i.btnFreezeUser', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            displayPopup({
//                Title: localization.translate('Freeze_User'),
//                Message: `${localization.translate('Freeze_User_Message')} '${row.data('user-name') }'`,
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Freeze'),
//                    Class: 'btn-danger',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('Freeze_User'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/FreezeUser',
//                            method: 'PUT',
//                            data: { Id: id }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updatePage();
//                                    displayMessage(localization.translate('Freeze_User'), localization.translate('Freeze_Successfully'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('Freeze_User'), localization.translate('Freeze_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('Freeze_User'), localization.translate('Freeze_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('Freeze_User'), localization.translate('Freeze_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });

//        $(document).off('click', 'i.btnUnfreezeUser').on('click', 'i.btnUnfreezeUser', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            displayPopup({
//                Title: localization.translate('Unfreeze_User'),
//                Message: `${localization.translate('Unfreeze_User_Message')} '${row.data('user-name')}'`,
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Unfreeze'),
//                    Class: 'btn-danger',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('Unfreeze_User'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/UnfreezeUser',
//                            method: 'PUT',
//                            data: { Id: id }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updatePage();
//                                    displayMessage(localization.translate('Unfreeze_User'), localization.translate('Unfreeze_Successfully'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('Unfreeze_User'), localization.translate('Unfreeze_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('Unfreeze_User'), localization.translate('Unfreeze_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('Unfreeze_User'), localization.translate('Unfreeze_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });

//        $(document).off('click', 'i.btnActivateUser').on('click', 'i.btnActivateUser', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            displayPopup({
//                Title: localization.translate('Activate_User'),
//                Message: `${localization.translate('Activate_User_Message')} '${row.data('user-name')}'`,
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Activate'),
//                    Class: 'btn-danger',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('Activate_User'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/ActivateUser',
//                            method: 'PUT',
//                            data: { Id: id }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updatePage();
//                                    displayMessage(localization.translate('Activate_User'), localization.translate('Activate_Successfully'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('Activate_User'), localization.translate('Activate_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('Activate_User'), localization.translate('Activate_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('Activate_User'), localization.translate('Activate_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });

//        $(document).off('click', 'i.btnDeleteUser').on('click', 'i.btnDeleteUser', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            displayPopup({
//                Title: localization.translate('User_Delete'),
//                Message: localization.translate('User_Delete_Message', { name: row.data('user-name') }),
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }],
//                Buttons: [{
//                    Text: localization.translate('Delete'),
//                    Class: 'btn-danger',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('User_Delete'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/DeleteUser',
//                            method: 'DELETE',
//                            data: { id }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updatePage();
//                                    displayMessage(localization.translate('User_Delete'), localization.translate('User_Delete_Success'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('User_Delete'), localization.translate('User_Delete_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('User_Delete'), localization.translate('User_Delete_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('User_Delete'), localization.translate('User_Delete_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });





//        $(document).off('click', 'i.btnEditUser').on('click', 'i.btnEditUser', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            let canModifyAccessLevel = row.data('modify-level');

//            displayPopup({
//                Title: localization.translate('User_Edit'),
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }, {
//                    Id: 'user-name',
//                    Name: localization.translate('User_Name'),
//                    Value: row.data('user-name'),
//                    Hint: localization.translate('User_Name_Hint'),
//                    Disabled: true
//                }, {
//                    Id: 'user-email',
//                    Name: localization.translate('User_Email'),
//                    Value: row.data('user-email'),
//                    Hint: localization.translate('User_Email_Hint')
//                }, {
//                    Id: 'user-level',
//                    Name: localization.translate('User_Level'),
//                    Hint: localization.translate('User_Level_Hint'),
//                    Type: 'select',
//                    SelectOptions: canModifyAccessLevel ? [
//                        {
//                            key: '0',
//                            selected: row.data('user-level') == '0',
//                            value: 'Free'
//                        },
//                        {
//                            key: '1',
//                            selected: row.data('user-level') == '1',
//                            value: 'Paid'
//                        },
//                        {
//                            key: '2',
//                            selected: row.data('user-level') == '2',
//                            value: 'Reviewer'
//                        },
//                        {
//                            key: '3',
//                            selected: row.data('user-level') == '3',
//                            value: 'Moderator'
//                        },
//                        {
//                            key: '4',
//                            selected: row.data('user-level') == '4',
//                            value: 'Admin'
//                        }
//                    ] : []
//                }],
//                Buttons: [{
//                    Text: localization.translate('Update'),
//                    Class: 'btn-success',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('User_Edit'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        let email = $('#popup-modal-field-user-email').val();
//                        const emailRegex = /^((?!\.)[\w\-_.]*[^.])(@[\w\-_]+)(\.\w+(\.\w+)?[^.\W])$/;
//                        if (email != undefined && email.length > 0 && !emailRegex.test(email)) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_Email'));
//                            return;
//                        }

//                        let level = $('#popup-modal-field-user-level').val();
//                        if (canModifyAccessLevel && (level == undefined || level.length == 0)) {
//                            displayMessage(localization.translate('User_Edit'), localization.translate('User_Invalid_Level'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/EditUser',
//                            method: 'PUT',
//                            data: { Id: id, Email: email, Level: level }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updateUsersList();
//                                    displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Success'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });

//        $(document).off('click', 'i.btnChangePassword').on('click', 'i.btnChangePassword', function (e) {
//            preventDefaults(e);

//            if ($(this).attr('disabled') == 'disabled') {
//                return;
//            }

//            let row = $(this).closest('tr');
//            displayPopup({
//                Title: localization.translate('User_Edit'),
//                Fields: [{
//                    Id: 'user-id',
//                    Value: row.data('user-id'),
//                    Type: 'hidden'
//                }, {
//                    Id: 'user-password',
//                    Name: localization.translate('User_Password'),
//                    Value: row.data('user-password'),
//                    Hint: localization.translate('User_Password_Hint'),
//                    Type: 'password'
//                }, {
//                    Id: 'user-cpassword',
//                    Name: localization.translate('User_Confirm_Password'),
//                    Value: row.data('user-cpassword'),
//                    Hint: localization.translate('User_Confirm_Password_Hint'),
//                    Type: 'password',
//                    Class: 'confirm-password'
//                }],
//                FooterHtml: `${generatePasswordValidation('input#popup-modal-field-user-password')}<script>initPasswordValidation();</script>`,
//                Buttons: [{
//                    Text: localization.translate('Update'),
//                    Class: 'btn-success',
//                    Callback: function () {
//                        displayLoader(localization.translate('Loading'));

//                        let id = $('#popup-modal-field-user-id').val();
//                        if (id == undefined || id.length == 0) {
//                            displayMessage(localization.translate('User_Edit'), localization.translate('User_Missing_Id'));
//                            return;
//                        }

//                        let password = $('#popup-modal-field-user-password').val();
//                        if (password == undefined || password.length < 8) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_Password'));
//                            return;
//                        }

//                        let cpassword = $('#popup-modal-field-user-cpassword').val();
//                        if (password == undefined || password !== cpassword) {
//                            displayMessage(localization.translate('User_Create'), localization.translate('User_Invalid_CPassword'));
//                            return;
//                        }

//                        $.ajax({
//                            url: '/Account/ChangeUserPassword',
//                            method: 'PUT',
//                            data: { Id: id, Password: password, CPassword: cpassword }
//                        })
//                            .done(data => {
//                                if (data.success === true) {
//                                    updateUsersList();
//                                    displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Success'));
//                                } else if (data.message) {
//                                    displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Failed'), [data.message]);
//                                } else {
//                                    displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Failed'));
//                                }
//                            })
//                            .fail((xhr, error) => {
//                                displayMessage(localization.translate('User_Edit'), localization.translate('User_Edit_Failed'), [error]);
//                            });
//                    }
//                }, {
//                    Text: localization.translate('Close')
//                }]
//            });
//        });







//        $(document).off('keyup', 'input#audit-log-search-term, input#audit-log-limit').on('keyup', 'input#audit-log-search-term, input#audit-log-limit', function (e) {
//            let term = $('input#audit-log-search-term').val();
//            let limit = $('input#audit-log-limit').val();
            
//            updateAuditList(term, limit);
//        });
//    });
//})();