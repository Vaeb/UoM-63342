public class Simple3 {

    public static void main(String[] adamArgs) {
        
    }

    public static void test(String adamVariableS) {
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        // if (adamVariableS.contains("bc")) return;
        assert(!adamVariableS.contains(adamVariableU)); // This assert failure should be found by JBMC!
    }
}