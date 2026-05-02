using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using Memtly.Core.Constants;
using Memtly.Core.Enums;
using Memtly.Core.Helpers;
using Memtly.Core.Models;
using System.Reflection;

namespace Memtly.Core.Controllers
{
    [AllowAnonymous]
    public class ThemesController : BaseController
    {
        private readonly ISettingsHelper _settings;
        private readonly ILogger<ThemesController> _logger;
        private readonly IStringLocalizer<Localization.Translations> _localizer;

        // PhotoShare ships a single brand palette - operators get
        // Auto / Light (Blue) / Dark (DarkBlue). The other upstream
        // Memtly themes (Green/DarkGreen/Pink/DarkPink) stay on the
        // enum so previously-persisted Settings rows don't break,
        // but they're hidden from the picker. Display labels are
        // hardcoded (not localized) because they're brand UI copy.
        private static readonly Dictionary<Themes, string> SelectableThemes = new()
        {
            { Themes.AutoDetect, "Auto" },
            { Themes.Blue, "Light" },
            { Themes.DarkBlue, "Dark" },
        };

        public ThemesController(ISettingsHelper settings, ILanguageHelper languageHelper, ILogger<ThemesController> logger, IStringLocalizer<Localization.Translations> localizer)
            : base()
        {
            _settings = settings;
            _logger = logger;
            _localizer = localizer;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var options = new SupportedThemeList();

            try
            {
                var selectedTheme = HttpContext.Session.GetString(SessionKey.Theme.Selected);
                if (string.IsNullOrWhiteSpace(selectedTheme))
                {
                    selectedTheme = await _settings.GetOrDefault(MemtlyConfiguration.Themes.Default, Themes.AutoDetect.ToString());
                }

                foreach (var item in SelectableThemes)
                {
                    options.Themes.Add(new SupportedThemes()
                        {
                            Name = item.Value,
                            Value = item.Key.ToString(),
                            Selected = selectedTheme.Equals(item.Key.ToString(), StringComparison.OrdinalIgnoreCase)
                        });
                }
            }
            catch { }

            return Json(options);
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> ChangeDisplayTheme(string theme)
        {
            try
            {
                var selectedTheme = await _settings.GetOrDefault(MemtlyConfiguration.Themes.Default, Themes.AutoDetect.ToString());
                foreach (var item in SelectableThemes.Keys)
                {
                    if (item.ToString().Equals(theme, StringComparison.OrdinalIgnoreCase))
                    {
                        selectedTheme = item.ToString();
                        break;
                    }
                }

                HttpContext.Session.SetString(SessionKey.Theme.Selected, selectedTheme);
                Response.Cookies.Append(
                    SessionKey.Theme.Selected,
                    selectedTheme,
                    new CookieOptions { Expires = DateTimeOffset.UtcNow.AddYears(1), IsEssential = true, Secure = true, SameSite = SameSiteMode.Lax }
                );

                return Json(new { success = true });
            }
            catch (Exception ex) 
            {
                _logger.LogWarning(ex, "Failed to set display theme");

                theme = Enums.Themes.AutoDetect.ToString();

                HttpContext.Session.SetString(SessionKey.Theme.Selected, theme);
                Response.Cookies.Append(
                    SessionKey.Theme.Selected,
                    theme,
                    new CookieOptions { Expires = DateTimeOffset.UtcNow.AddYears(1), IsEssential = true, Secure = true, SameSite = SameSiteMode.Lax }
                );
            }

            return Json(new { success = false });
        }
    }
}