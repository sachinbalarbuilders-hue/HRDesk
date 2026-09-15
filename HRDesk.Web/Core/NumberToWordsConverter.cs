using System;

namespace HRDesk.Web.Core
{
    public static class NumberToWordsConverter
    {
        public static string Convert(int number)
        {
            if (number == 0) return "Zero Rupees Only";
            if (number < 0) return "Minus " + ConvertHelper(Math.Abs(number)) + " Rupees Only";

            return (ConvertHelper(number) + " Rupees Only").Replace("  ", " ").Trim();
        }

        private static string ConvertHelper(int number)
        {
            if (number == 0) return "";

            string words = "";

            if ((number / 10000000) > 0)
            {
                words += ConvertHelper(number / 10000000) + " Crore ";
                number %= 10000000;
            }

            if ((number / 100000) > 0)
            {
                words += ConvertHelper(number / 100000) + " Lakh ";
                number %= 100000;
            }

            if ((number / 1000) > 0)
            {
                words += ConvertHelper(number / 1000) + " Thousand ";
                number %= 1000;
            }

            if ((number / 100) > 0)
            {
                words += ConvertHelper(number / 100) + " Hundred ";
                number %= 100;
            }

            if (number > 0)
            {
                if (words != "") words += "and ";

                var unitsMap = new[] { "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
                var tensMap = new[] { "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

                if (number < 20)
                    words += unitsMap[number];
                else
                {
                    words += tensMap[number / 10];
                    if ((number % 10) > 0)
                        words += " " + unitsMap[number % 10];
                }
            }

            return words.Trim();
        }
    }
}
