let auditSearchTimeout = null;

export function initAuditConfig() {
    bindEventHandlers();
}

function bindEventHandlers() {
    $(document).off('keyup', 'input#audit-log-search-term, input#audit-log-limit').on('keyup', 'input#audit-log-search-term, input#audit-log-limit', function (e) {
        let term = $('input#audit-log-search-term').val();
        let limit = $('input#audit-log-limit').val();

        updateAuditList(term, limit);
    });
}

function updateAuditList(term = '', limit = 100) {
    clearTimeout(auditSearchTimeout);
    auditSearchTimeout = setTimeout(function () {
        $.ajax({
            type: 'POST',
            url: `/Account/AuditList`,
            data: { term: term?.trim(), limit: limit },
            success: function (data) {
                $('#audit-list').html(data);
            }
        });
    }, 500);
}