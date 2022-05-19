import org.sosy_lab.sv_benchmarks.Verifier;

public class Simple2 {
    public static void main(String[] mainArgs) {
        int first = 55;
        String nondetStr = Verifier.nondetString();
        int nondetInt = Verifier.nondetInt();
        float nondetFloat = Verifier.nondetFloat();
        double nondetDouble = Verifier.nondetDouble();
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

