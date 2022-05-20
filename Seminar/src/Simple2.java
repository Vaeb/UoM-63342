import org.sosy_lab.sv_benchmarks.Verifier;

public class Simple2 {
    public static void main(String[] mainArgs) {
        int first = 55;
        String nondetStr = Verifier.nondetString();
        String nondetStrNone = Verifier.nondetString();
        int nondetInt = Verifier.nondetInt();
        int nondetIntOther = Verifier.nondetInt();
        float nondetFloat = Verifier.nondetFloat();
        double nondetDouble = Verifier.nondetDouble();
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

