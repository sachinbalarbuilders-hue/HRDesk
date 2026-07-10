namespace HRDesk.Web.Services;

public static class VerifyModeDecoder
{
    public static string Decode(int mode)
    {
        // The ZKTeco/eSSL SDK packs multiple data points into the VerifyMode integer.
        // Byte 0 (Least Significant Byte) contains the actual verification method.
        // Byte 1 contains the attendance status (In/Out/etc).
        // By using a bitwise AND (& 0xFF), we isolate just Byte 0 and ignore the rest.
        int baseMode = mode & 0xFF;

        return baseMode switch
        {
            1 or 4 or 5 or 7 or 51 or 101 or 151 => "Fingerprint",
            30 or 31 or 32 or 33 or 34 or 
            80 or 81 or 82 or 83 or 84 or 
            130 or 131 or 132 or 133 or 134 or 
            180 or 181 or 182 or 183 or 184 => "Face",
            2 or 6 or 52 or 102 or 152 => "Password",
            3 or 53 or 103 or 153 => "Card",
            10 or 11 or 12 or 13 or 14 or 20 or 21 or 22 or 23 => "Access Control Event",
            _ => $"Mode({mode})"
        };
    }
}
