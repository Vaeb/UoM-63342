# UoM-63342

The program will generate new Java files to reproduce vulnerabilities discovered by JBMC (Java Bounded Model Checking). Works successfully, although there are limitations to the acceptable nondeterministic data types. Current acceptable nondeterministic data types:
- Ints
- Floats
- Doubles
- Strings

### Examples:

Run against a single Java class file named 'Simple':
```
node src/counterexample.js --unwind 5 --path src/Simple
```
Run against all SV-COMP tests:
```
node src/counterexample.js --unwind 5 --path svc
```
