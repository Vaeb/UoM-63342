import org.sosy_lab.sv_benchmarks.Verifier;

public class Simple2 {
    public static void main(String[] mainArgs) {
        int first = 55;
        String nondetStr = "dogbc"; // [JBMC Changed] [Original: Verifier.nondetString()]
        String nondetStrNone = null; // [JBMC Changed] [Original: Verifier.nondetString()]
        int nondetInt = 7; // [JBMC Changed] [Original: Verifier.nondetInt()]
        int nondetIntOther = 0; // [JBMC Changed] [Original: Verifier.nondetInt()]
        float nondetFloat = 0.0ff; // [JBMC Changed] [Original: Verifier.nondetFloat()]
        double nondetDouble = 9.38547e+154d; // [JBMC Changed] [Original: Verifier.nondetDouble()]
        nondetIntOther = 5;
        String mustNotContain = "bc";
        String willContain = "a";
        String thing = "ab";
        if (nondetStrNone == null) {
            nondetStrNone = "new string value";
            thing = thing + nondetStr;
            if (nondetStr == null || !nondetStr.contains("dog")) return;
            assert(!nondetStr.contains(mustNotContain) || nondetInt < 7 || nondetFloat < 7 || nondetDouble < 7);
            System.out.println(thing);
            System.out.println(nondetFloat);
            System.out.println(nondetDouble);
            System.out.println(nondetInt);
        }
    }
}

