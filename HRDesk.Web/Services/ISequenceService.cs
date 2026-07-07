namespace HRDesk.Web.Services;

public interface ISequenceService
{
    Task<string> GenerateApplicationNumberAsync(DateOnly requestDate);
    Task<string> PeekNextApplicationNumberAsync(DateOnly requestDate);
    Task ResyncSequenceAsync(int year, int month);
    Task EnsureSequenceCatchUpAsync(DateOnly date, string appNo);
}
