/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/cbmc-java/ArithmeticException1
 * The benchmark was taken from the repo: 24 January 2018
 */
import org.sosy_lab.sv_benchmarks.Verifier;

public class Main {
  public static void main(String args[]) {
    try {
      int i = 0; // [JBMC Changed] [Original: Verifier.nondetInt()]
      int j = 10 / i;
    } catch (ArithmeticException exc) {
      assert false;
    }
  }
}
