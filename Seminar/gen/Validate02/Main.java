/*
 * Origin of the benchmark:
 *     license: 4-clause BSD (see /java/jbmc-regression/LICENSE)
 *     repo: https://github.com/diffblue/cbmc.git
 *     branch: develop
 *     directory: regression/jbmc-strings/Validate02
 * The benchmark was taken from the repo: 24 January 2018
 */
import org.sosy_lab.sv_benchmarks.Verifier;

public class Main {
  public static void main(String[] args) {
    String address = "?"; // [JBMC Changed] [Original: Verifier.nondetString()]
    String city = "?"; // [JBMC Changed] [Original: Verifier.nondetString()]
    String state = "?"; // [JBMC Changed] [Original: Verifier.nondetString()]
    String zip = null; // [JBMC Changed] [Original: Verifier.nondetString()]
    String phone = null; // [JBMC Changed] [Original: Verifier.nondetString()]

    if (!ValidateInput02.validateAddress(address)) assert false;
    else if (!ValidateInput02.validateCity(city)) System.out.println("Invalid city");
    else if (!ValidateInput02.validateState(state)) System.out.println("Invalid state");
    else if (!ValidateInput02.validateZip(zip)) System.out.println("Invalid zip code");
    else System.out.println("Valid input.  Thank you.");
  }
}
