/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/cbmc-java/synchronized
 * The benchmark was taken from the repo: 24 January 2018
 */
public class Main1 {
  public static void main(String[] args) {
    final Object o = null;
    System.out.println("trying");
    try {
      synchronized (o) {
      }
      System.out.println("failed");
      assert false;
    } catch (NullPointerException e) {
        System.out.println("caught");
      return;
    }
  }
}
