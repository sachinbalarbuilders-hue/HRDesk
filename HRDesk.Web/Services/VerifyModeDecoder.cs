namespace HRDesk.Web.Services;

public static class VerifyModeDecoder
{
    public static string Decode(int mode)
    {
        return mode switch
        {
            1 or 4 or 5 or 7 or 34 or 51 or 101 or 151 or 436 => "Fingerprint",
            30 or 31 or 32 or 33 or 407 => "Face",
            2 or 15 or 52 or 102 or 152 => "Password",
            3 or 53 or 103 or 153 => "Card",
            _ => $"Mode({mode})"
        };
    }
}
