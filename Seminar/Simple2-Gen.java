import org.sosy_lab.sv_benchmarks.Verifier;

public class Simple2 {
    public static void main(String[] mainArgs) {
        int first = 55;
        String nondetStr = "dogbc"; // [JBMC Changed] [Original: Verifier.nondetString()]
        int nondetInt = 7; // [JBMC Changed] [Original: Verifier.nondetInt()]
        float nondetFloat = 3.68935e+19f; // [JBMC Changed] [Original: Verifier.nondetFloat()]
        double nondetDouble = 2.68156e+154d; // [JBMC Changed] [Original: Verifier.nondetDouble()]
        String realStr = "orig string";
        realStr = "new string";
        // if (nondetInt < 2) return;
        int realInt = 5;
        String lol = null;
        String mustNotContain = "bc";
        String willContain = "a";
        String thing = "ab";
        if (lol == null) {
            lol = "thingy";
            thing = thing + nondetStr;
            // if (nondetInt < 4) return;
            // nondetInt = 9;
            if (nondetStr == null || !nondetStr.contains("dog")) return;
            // nondetInt = 10;
            assert(!nondetStr.contains(mustNotContain) || nondetInt < 7 || nondetFloat < 7 || nondetDouble < 7);
            System.out.println(thing);
            System.out.println(nondetFloat);
            // assert(nondetInt > 7);
            System.out.println(nondetDouble);
            System.out.println(nondetInt);
        }
    }
}

