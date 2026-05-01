namespace Memtly.Core.Helpers
{
    public enum PasswordVerification
    {
        Failed = 0,
        Success = 1,
        // Stored credential matched the supplied password but is in the legacy
        // reversibly-encrypted format. Caller should rehash with BCrypt and
        // persist the new hash before returning success to the user.
        SuccessNeedsRehash = 2,
    }

    public interface IPasswordHasher
    {
        string Hash(string plaintext);
        PasswordVerification Verify(string plaintext, string? storedHash, string usernameForLegacy);
        bool IsLegacyHash(string? storedHash);
    }

    public class PasswordHasher : IPasswordHasher
    {
        private const int BCryptWorkFactor = 12;

        private readonly IEncryptionHelper _encryption;

        public PasswordHasher(IEncryptionHelper encryption)
        {
            _encryption = encryption;
        }

        public string Hash(string plaintext)
        {
            if (string.IsNullOrEmpty(plaintext))
            {
                throw new ArgumentException("Password must not be empty.", nameof(plaintext));
            }
            return BCrypt.Net.BCrypt.HashPassword(plaintext, workFactor: BCryptWorkFactor);
        }

        public PasswordVerification Verify(string plaintext, string? storedHash, string usernameForLegacy)
        {
            if (string.IsNullOrEmpty(plaintext) || string.IsNullOrEmpty(storedHash))
            {
                return PasswordVerification.Failed;
            }

            if (!IsLegacyHash(storedHash))
            {
                try
                {
                    return BCrypt.Net.BCrypt.Verify(plaintext, storedHash)
                        ? PasswordVerification.Success
                        : PasswordVerification.Failed;
                }
                catch
                {
                    return PasswordVerification.Failed;
                }
            }

            // Legacy: reversibly encrypted via IEncryptionHelper, salted by
            // lowercase username. Reproduce the encryption and compare.
            var legacyEncrypted = _encryption.Encrypt(plaintext, usernameForLegacy.ToLower());
            return string.Equals(storedHash, legacyEncrypted, StringComparison.Ordinal)
                ? PasswordVerification.SuccessNeedsRehash
                : PasswordVerification.Failed;
        }

        public bool IsLegacyHash(string? storedHash)
        {
            if (string.IsNullOrEmpty(storedHash))
            {
                return false;
            }
            // BCrypt produces values that start with $2a$, $2b$, or $2y$ (60 chars total).
            return !(storedHash.StartsWith("$2a$", StringComparison.Ordinal)
                || storedHash.StartsWith("$2b$", StringComparison.Ordinal)
                || storedHash.StartsWith("$2y$", StringComparison.Ordinal));
        }
    }
}
