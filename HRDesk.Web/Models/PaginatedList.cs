using Microsoft.EntityFrameworkCore;

namespace HRDesk.Web.Models;

public interface IPaginatedList
{
    int PageIndex { get; }
    int TotalPages { get; }
    int TotalCount { get; }
    int PageSize { get; }
    int Count { get; }
    bool HasPreviousPage { get; }
    bool HasNextPage { get; }
}

public class PaginatedList<T> : List<T>, IPaginatedList
{
    public int PageIndex { get; private set; }
    public int TotalPages { get; private set; }
    public int TotalCount { get; private set; }
    public int PageSize { get; private set; }

    public PaginatedList(List<T> items, int count, int pageIndex, int pageSize)
    {
        PageIndex = pageIndex;
        TotalPages = (int)Math.Ceiling(count / (double)pageSize);
        TotalCount = count;
        PageSize = pageSize;

        this.AddRange(items);
    }

    public bool HasPreviousPage => PageIndex > 1;
    public bool HasNextPage => PageIndex < TotalPages;

    public static async Task<PaginatedList<T>> CreateAsync(IQueryable<T> source, int pageIndex, int pageSize)
    {
        var count = await source.CountAsync();
        
        // Ensure pageIndex is valid
        var totalPages = (int)Math.Ceiling(count / (double)pageSize);
        if (pageIndex > totalPages && totalPages > 0)
        {
            pageIndex = totalPages;
        }
        else if (pageIndex < 1)
        {
            pageIndex = 1;
        }
        
        var items = await source.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PaginatedList<T>(items, count, pageIndex, pageSize);
    }
}
