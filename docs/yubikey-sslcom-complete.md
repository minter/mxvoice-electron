# YubiKey + SSL.com Code Signing  
## Complete Setup Guide (ECC P-384, PIN Policy = ONCE)

## Reset and Prepare YubiKey PIV
```powershell
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv reset
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv change-pin
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv change-puk
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv change-management-key --generate
```

## Generate ECC P-384 Key in Slot 9A
```powershell
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv keys generate --algorithm ECCP384 --pin-policy once 9a public.pem
```

## Generate CSR (RFC2253)
```powershell
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv certificates request 9a public.pem csr.pem --subject "CN=Haynie Minter,O=Haynie Minter,L=Wake Forest,ST=North Carolina,C=US"
```


## Export Attestation
```powershell
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv keys attest -F PEM 9a attestation.crt
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv certificates export -F PEM f9 intermediateCA.crt
```

## Validate Attestation
```powershell
Invoke-WebRequest "https://developers.yubico.com/PIV/Introduction/piv-attestation-ca.pem" -OutFile yubico-root.crt
openssl verify -CAfile yubico-root.crt -untrusted intermediateCA.crt attestation.crt
```

## Import Reissued Certificate into Slot 9A
```powershell
openssl x509 -in newcert.der -inform DER -out newcert.pem
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv certificates import 9a newcert.pem
```

## Install Certificate in Windows Store
```powershell
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv certificates export 9a -F PEM sslcom-yubi-9a.pem
certutil -user -addstore My sslcom-yubi-9a.pem
```


## Find Thumbprint
```powershell
Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*Haynie Minter*" } | Select Thumbprint, Subject
```

## Verify Slot 9A
```powershell
& "C:\Program Files\Yubico\YubiKey Manager\ykman.exe" piv keys info 9a
```

Expected:
```
Algorithm: ECCP384
PIN required for use: ONCE
Touch required for use: NEVER
```

## Sign (No Timestamp)
```powershell
signtool sign /debug /v /sha1 EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9 /fd sha256 "./Mx. Voice.exe"
```

## Sign with Timestamp (Correct TSA)
```powershell
signtool sign /debug /v /sha1 EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9 /fd sha256 /td sha256 /tr http://ts.ssl.com "./Mx. Voice.exe"
```

## Why PIN Prompts Still Appear
signtool starts a new process each time. YubiKey caches per card session.  
**Solution:** Sign everything in one command.

## Final Recommended Command
```powershell
signtool sign /v /sha1 EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9 /fd sha256 /td sha256 /tr http://ts.ssl.com "Mx. Voice.exe"
```
