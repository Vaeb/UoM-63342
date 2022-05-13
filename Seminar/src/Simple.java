public class Simple {
    public static String nondetStr = "generated_by_jbmc";

    public static void main(String[] adamArgs) {
        String mustNotContain = "bc";
        String willContain = "a";
        if (nondetStr == null || !nondetStr.contains(willContain)) return;
        assert(!nondetStr.contains(mustNotContain));
    }
}

