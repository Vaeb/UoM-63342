/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/cbmc-java/ArrayIndexOutOfBoundsException1
 * The benchmark was taken from the repo: 24 January 2018
 */
import org.sosy_lab.sv_benchmarks.Verifier;

public class Main {
  public static void main(String args[]) {
    int size = 5; // [JBMC Changed] [Original: Verifier.nondetInt()]
    if (size < 0) return;
    try {
      int[] a = new int[4];
      a[size] = 0;
    } catch (ArrayIndexOutOfBoundsException exc) {
      assert false;
    }
  }
}
