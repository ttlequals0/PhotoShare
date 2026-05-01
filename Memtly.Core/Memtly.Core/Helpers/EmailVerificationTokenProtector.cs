using System.Text.Json;
using Memtly.Core.Models;
using Microsoft.AspNetCore.DataProtection;

namespace Memtly.Core.Helpers
{
    public interface IEmailVerificationTokenProtector
    {
        string Protect(EmailVerificationModel model, TimeSpan expiry);
        bool TryUnprotect(string token, out EmailVerificationModel? model);
    }

    public class EmailVerificationTokenProtector : IEmailVerificationTokenProtector
    {
        private readonly ITimeLimitedDataProtector _protector;

        public EmailVerificationTokenProtector(IDataProtectionProvider provider)
        {
            // Versioned purpose so rotating to a v2 protector later (e.g.
            // for envelope schema changes) doesn't accept v1 tokens.
            _protector = provider
                .CreateProtector("PhotoShare.EmailVerification.v1")
                .ToTimeLimitedDataProtector();
        }

        public string Protect(EmailVerificationModel model, TimeSpan expiry)
        {
            var json = JsonSerializer.Serialize(model);
            return _protector.Protect(json, DateTimeOffset.UtcNow.Add(expiry));
        }

        public bool TryUnprotect(string token, out EmailVerificationModel? model)
        {
            model = null;
            if (string.IsNullOrWhiteSpace(token))
            {
                return false;
            }
            try
            {
                var json = _protector.Unprotect(token);
                model = JsonSerializer.Deserialize<EmailVerificationModel>(json);
                return model != null;
            }
            catch
            {
                // Tampered envelope, expired, or wrong-purpose key.
                return false;
            }
        }
    }
}
