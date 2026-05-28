---
title: Sysmon 이벤트 로그
parent: 탐지 / 대응 (Blue Team)
nav_order: 2
---

# Sysmon

[Windows 이벤트 로그]({% link docs/blue-team/windows-event-log.md %})에서 기본 Security 로그만으로는 네트워크 연결, 파일 생성, 프로세스의 부모-자식 관계를 보기 불편한 단점이 있다고 했다. 이 단점을 해결하는 게 Sysmon이다.

---

## Sysmon이란

Sysmon은 Microsoft의 Sysinternals 도구 중 하나로, 시스템 부팅 초기부터 동작하는 디바이스 드라이버 + 서비스 형태의 로깅 도구다. 설치하면 프로세스 생성, 네트워크 연결, 파일 생성 같은 활동을 상세하게 기록해서 Applications and Services Logs -> Microsoft-Windows-Sysmon -> Operational 채널에 남긴다.


### 특징

- 기본 로그보다 훨씬 더 자세한 정보를 남긴다 — 같은 프로세스 생성이라도 부모 프로세스, 커맨드라인, 실행 파일의 해시까지 함께 기록한다.
- 설정 파일로 무엇을 기록할지 정밀하게 제어한다 — 무엇을 남기고 무엇을 버릴지를 설정할 수 있다.


---

## 기본 로그 vs Sysmon


| 항목 | 기본 Security 로그 | Sysmon |
| --- | --- | --- |
| 프로세스 생성 | `4688` | `Event ID 1` — **부모 프로세스, 해시, ProcessGUID**까지 |
| 네트워크 연결 |  없음 | `Event ID 3` — 출발/목적지 IP, 포트, 연결한 프로세스 |
| 파일 생성 | 없음 | `Event ID 11` — 어떤 프로세스가 어떤 파일을 만들었는지 |
| 부모-자식 관계 | 보기 어려움 | `ParentImage` / `ParentCommandLine`로 쉽게 볼 수 있음 |
| 실행 파일 해시 | 없음 | `MD5`/`SHA256`/`IMPHASH` 등 |
| DNS 질의 | 없음 | `Event ID 22` |

---

## SOC가 보는 핵심 Sysmon 이벤트 ID

| Event ID | 의미 | 분석 포인트 |
| --- | --- | --- |
| 1 | 프로세스 생성 | 부모 프로세스, 커맨드라인, 해시. |
| 2 | 파일 생성 시각 변경 | 타임스탬프 조작 흔적 |
| 3 | 네트워크 연결 | 어떤 프로세스가 어디로 연결했나 |
| 5 | 프로세스 종료 | 세션,실행 흐름 추적 |
| 7 | 이미지(DLL) 로드 | DLL 사이드로딩 탐지 |
| 8 | CreateRemoteThread | 한 프로그램이 다른 프로그램 안에 코드를 몰래 실행하려는 행동 |
| 10 | 프로세스 접근 | lsass 접근 = 자격증명 탈취(Mimikatz) 의심 |
| 11 | 파일 생성 | 어떤 프로세스가 어떤 파일을 만들었는지 |
| 12 / 13 / 14 | 레지스트리 생성/변경 | 지속성(Run 키 등) 흔적 |
| 22 | DNS 질의 | 어떤 프로세스가 어떤 도메인을 조회했는지 |
| 23 | 파일 삭제 | 흔적 제거 / 도구 정리 |

> lsass  : Windows에서 로그인 정보, 인증 관련 정보를 다루는 중요한 프로세스


---

## Sysmon의 강점 — 부모-자식 프로세스 관계

| 필드 | 의미 |
| --- | --- |
| `Image` | 실행된 프로세스 |
| `CommandLine` | 명령어 전체 |
| `ParentImage` | **부모 프로세스** |
| `ParentCommandLine` | 부모 프로세스가 어떤 명령어로 실행됐는지 |
| `ProcessGuid` | 프로세스를 전역적으로 식별하는 고유 ID (PID 재사용 문제 없음) |

> PID (Process ID) : 운영체제가 실행 중인 프로세스에 붙이는 짧은 번호. 프로세스가 끝나면 같은 번호가 나중에 다른 프로세스에 다시 쓰일 수 있음.

> ProcessGuid: Sysmon이 프로세스마다 부여하는 고유 식별자. 한 번 부여되면 다시 사용되지 않아서 로그 분석할 때 어떤 프로세스인지 정확히 구분할 수 있음.

Sysmon에서 부모 프로세스와 CommandLine이 중요한 이유는 공격 흐름을 따라가기 위해서다.  
단순히 `powershell.exe`가 실행됐다는 사실만으로는 정상인지 공격인지 판단하기 어렵다.

하지만 `winword.exe -> powershell.exe -> cmd.exe`처럼 Word 문서가 PowerShell을 실행하고 Powerㄴhell이 다시 cmd를 실행했다면 악성 문서나 매크로 실행을 의심할 수 있다.

즉 Sysmon은 무슨 프로그램이 실행됐는지뿐만 아니라 누가 실행했고 그 뒤에 무엇이 이어졌는지를 보여주기 때문에 중요하다.

---

## 4688 vs Sysmon Event ID 1

둘 다 프로세스 생성을 기록하지만 성격이 다르다.

| 항목 | Security 4688 | Sysmon Event ID 1 |
| --- | --- | --- |
| 활성화 | 감사 정책 + 커맨드라인 설정 필요 | Sysmon 설치 + 설정 파일 적용|
| 부모 프로세스 | 부모 PID만 | 부모 프로세스 Image, CommandLine, ProcessGuid까지 볼 수 있음 |
| 해시 | 없음 | MD5/SHA256/IMPHASH |
| 제공 정보 | 제한적 | CommandLine, 부모 프로세스, 해시, ProcessGuid 등 더 자세한 정보 제공 |
| 설정 제어 | 거의 불가 | XML로 정밀하게 제어 |

---

## SIEM 연동과 실제 탐지

Sysmon 로그는 각 엔드포인트에 따로 남기 때문에 그대로 두면 분석하기 어렵다.  

그래서 Universal Forwarder 같은 수집기를 사용해 로그를 SIEM으로 보내고 한곳에서 검색하고 탐지할 수 있게 만든다.

Sysmon Operational 로그를 Splunk로 수집할 때의 입력 설정은 다음과 같다.

```ini
[WinEventLog://Microsoft-Windows-Sysmon/Operational]
disabled = false
index = main
renderXml = true
```

실제로 이 Sysmon 로그(Event ID 1,3,11)를 Splunk로 수집해 공격을 탐지하고 대시보드로 묶은 전체 사이클은 [Splunk Windows SOC 탐지 Lab]({% link docs/Projects/SIEM_Projects.md %})에 정리되어있다. 거기서는

- Event ID 1 — Discovery 명령(`whoami`, `net`, `ipconfig`)이 PowerShell 아래에서 연속 실행되는 패턴
- Event ID 3 — Powershell이 외부 IP로 연결하는 의심스러운 통신
- Event ID 11 — 다운로드한 악성 파일이 사용자 경로에 생성

을 각각 SPL쿼리로 잡아냈다.
