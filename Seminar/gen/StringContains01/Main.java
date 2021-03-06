/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/jbmc-strings/StringContains01
 * The benchmark was taken from the repo: 24 January 2018
 */
import org.sosy_lab.sv_benchmarks.Verifier;

public class Main {
  public static void main(String[] args) {
    String ab = "?"; // [JBMC Changed] [Original: Verifier.nondetString()]
    String s = "???"; // [JBMC Changed] [Original: Verifier.nondetString()]
    assert (ab.contains(s));
  }
}
