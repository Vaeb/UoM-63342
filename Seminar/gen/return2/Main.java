/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/cbmc-java/return2
 * The benchmark was taken from the repo: 24 January 2018
 */
import org.sosy_lab.sv_benchmarks.Verifier;

class Main {
  public static void main(String[] args) {
    int v1 = 1; // [JBMC Changed] [Original: Verifier.nondetInt()]
    int v2 = 0; // [JBMC Changed] [Original: Verifier.nondetInt()]
    assert v1 == v2; // should be able to fail
  }
}
