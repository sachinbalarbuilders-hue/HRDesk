namespace HRDesk.Web.Models;

public class PaginationViewModel
{
    public IPaginatedList List { get; set; } = default!;
    public Dictionary<string, string?> QueryParams { get; set; } = new();
    public string PageName { get; set; } = "./Index";
}
