public class Simple {
    public static String nondetStr = "abc"; // [JBMC Changed] [Original: ""]
    public static int nondetInt = 1;
    public static float nondetFloat = 2.222f;
    public static double nondetDouble = 2.68156e+154d; // [JBMC Changed] [Original: 3.333]

    public static void main(String[] mainArgs) {
        // int first = 55;
        // if (nondetInt < 2) return;
        String mustNotContain = "bc";
        String lol = null;
        String willContain = "a";
        String thing = "ab";
        thing = thing + nondetStr;
        if (lol == null) {
            lol = "lol";
            // if (nondetInt < 4) return;
            // Simple.nondetInt = 9;
            if (nondetStr == null || !nondetStr.contains(willContain)) return;
            // Simple.nondetInt = 10;
            assert(!nondetStr.contains(mustNotContain) || nondetInt < 7 || nondetFloat < 7 || nondetDouble < 7);
            System.out.println(thing);
            System.out.println(nondetFloat);
            // assert(nondetInt > 7);
            System.out.println(nondetDouble);
            System.out.println(nondetInt);
        }
    }
}

