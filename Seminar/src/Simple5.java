public class Simple5 {
    public static String nondetStr;

    public static void main(String[] adamArgs) {
        String adamVariableS = nondetStr;
        String adamVariableU = "bc";
        if (adamVariableS == null || !adamVariableS.contains("a")) return;
        assert(!adamVariableS.contains(adamVariableU));
    }
}

