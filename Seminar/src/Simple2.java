import org.cprover.CProver;

public class Simple2 {
    // public static String nondetStr;

    public static void main(String[] adamArgs) {
        // String adamVariableS = nondetStr;
        String adamVariableS = CProver.nondetWithoutNull("");
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }
}