using Microsoft.AspNetCore.Mvc.RazorPages;
using WeddingShare.Models.Database;

namespace WeddingShare.Views.Account.Tabs
{
    public class AccountModel : PageModel
    {
        public AccountModel() 
        {
        }
            
        public UserModel? Account { get; set; }

        public void OnGet()
        {
        }
    }
}