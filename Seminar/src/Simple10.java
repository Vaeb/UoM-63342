public class Simple10 {
    public static String nondetStr;
    public static String nondetStr2;

    public static void thing1() {
        String adamVariableS = nondetStr2;
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }

    public static void main(String[] adamArgs) {
        Simple10.thing1();
        String adamVariableS = nondetStr;
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }
}