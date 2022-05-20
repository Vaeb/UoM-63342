/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/jbmc-strings/StringValueOf08
 * The benchmark was taken from the repo: 24 January 2018
 */
import org.sosy_lab.sv_benchmarks.Verifier;

public class Main {
  public static void main(String[] args) {
    String arg = null; // [JBMC Changed] [Original: Verifier.nondetString()]
    float floatValue = Float.parseFloat(arg);
    String tmp = String.valueOf(floatValue);
    assert tmp.equals("2.50");
  }
}
