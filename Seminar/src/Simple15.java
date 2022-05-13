public class Simple15 {
    public static String nondetStr;
    public static String nondetStr2;
    public static String nondetStr3;

    public static void thing2() {
        String adamVariableS = nondetStr3;
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }

    public static void thing1() {
        String adamVariableS = nondetStr2;
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }

    public static void main(String[] adamArgs) {
        Simple15.thing1();
        Simple15.thing2();
        String adamVariableS = nondetStr;
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }
}