---
title: Splunk 웹 공격 탐지 Lab
parent: SIEM / 보안관제 프로젝트
nav_order: 2
---

# Splunk 웹 공격 탐지 Lab

DVWA를 대상으로 SQL Injection, XSS, LFI, Command Injection, 웹쉘 업로드 공격을 직접 수행하고 그 흔적이 남은 Apache 접근 로그와 Linux auditd 로그를 Splunk로 수집해 탐지/대응까지 한 실습 프로젝트다.

---

## 프로젝트 개요

1. Kali에서 DVWA로 웹 공격 수행
2. 그 요청이 남긴 Apache 접근 로그(`access_combined`)와 Linux auditd 로그(`linux_audit`)를 Splunk로 수집
3. 로그에서 공격 패턴을 찾아내는 SPL 탐지 쿼리 작성
4. 탐지 결과를 인시던트 티켓으로 정리하고 대시보드로 시각화

다룬 공격은 SQL Injection, Reflected XSS, LFI, Command Injection, 파일 업로드 웹쉘까지 OWASP에서 자주 다루는 웹 취약점 다섯 가지다.

## 실습 환경

| 구분 | 내용 |
|---|---|
| Host OS | Arch Linux |
| 가상화 | KVM / QEMU (`192.168.122.0/24`) |
| SIEM | Splunk Enterprise |
| 대상 | DVWA (Debian 13, Apache 2.4.67, PHP 8.4.21) `192.168.122.20` + Splunk Universal Forwarder |
| 공격자 | Kali Linux `192.168.122.96` |
| 로그 소스 | Apache access log (`access_combined`), Linux auditd (`linux_audit`) |

Kali Linux -> 공격대상으로 웹 공격이 일어나고 공격대상의 Apache 접근 로그와 auditd 로그는 Universal Forwarder를 통해 Splunk 서버의 `main` 인덱스로 전달되게 구성했다.

DVWA는 Security Level을 low로 두고 기본 취약 설정 그대로 사용했다.

![DVWA 대상 환경 설정](/assets/images/web-attack-detection-lab/dvwa-setting1.png)


## 데이터 파이프라인 점검

탐지 쿼리를 만들기 전에 로그가 실제로 기록되고 Splunk까지 들어오는지부터 확인했다.

먼저 대상 호스트에서 Apache 접근 로그가 정상적으로 쌓이는지 봤다. `/var/log/apache2/access.log`에 combined 포맷으로 요청이 기록된다.

![Apache 접근 로그 확인](/assets/images/web-attack-detection-lab/step3-apache-access-log.png)

파일 업로드 웹쉘처럼 접근 로그만으로는 부족한 공격을 잡기 위해 웹 루트(`/var/www/html`)에 auditd 파일 변경 룰을 설정했다. `-k webroot_change` 키로 웹 루트 안의 변경 이벤트를 기록하도록 했고 `touch`로 테스트 파일을 만들어 실제로 `webroot_change` 키가 붙은 감사 이벤트가 남는 것을 확인했다.

```bash
sudo auditctl -w /var/www/html -p wa -k webroot_change
sudo auditctl -l
sudo touch /var/www/html/fim_test.php
sudo ausearch -k webroot_change -i | tail -n 20
```

![auditd webroot 변경 감시 이벤트](/assets/images/web-attack-detection-lab/step4-auditd-fim-event.png)

다음으로 Splunk에서 두 sourcetype이 함께 `main` 인덱스로 들어오는지 확인했다.

```spl
index=main (sourcetype=access_combined OR sourcetype=linux_audit)
```

Universal Forwarder가 정상 동작하면 Apache 접근 로그(`access_combined`)와 auditd 로그(`linux_audit`)가 같은 인덱스에서 함께 조회된다. 최근 60분 기준으로 두 sourcetype 이벤트가 `dvwa` 호스트에서 들어오는 것을 확인했다.

![두 sourcetype 수집 확인](/assets/images/web-attack-detection-lab/step5-splunk-uf-data-arriving.png)

마지막으로 디코딩을 점검했다. `uri`는 `%2F`, `%3B`처럼 URL 인코딩된 채로 들어오기 때문에 디코딩이 필요하다.

```spl
index=main sourcetype=access_combined clientip="192.168.122.96"
| eval url=urldecode(uri)
| table _time clientip method url status
```

![urldecode](/assets/images/web-attack-detection-lab/step6-decoded-attack-urls.png)


## 공격 시나리오 & 탐지

모든 공격은 단일 공격자 `192.168.122.96`에서 발생했다. 공격 종류별로 사용한 로그, MITRE ATT&CK 분류, 공격 방법, 탐지 SPL, 탐지 결과를 함께 정리했다.

### 탐지 1 - SQL Injection

**사용 로그:** Apache access log (`access_combined`)

**MITRE ATT&CK:** Initial Access / Exploit Public-Facing Application (T1190)

DVWA의 SQL Injection 페이지(`/vulnerabilities/sqli/`)를 공격했다. 먼저 `id` 파라미터에 따옴표(`'`)하나를 넣어 쿼리가 깨지면서 HTTP 500이 나는 것으로 주입 지점을 확인했다.

![500 에러 확인](/assets/images/web-attack-detection-lab/attack-sqli-01-injectable-500.png)

이어서 `1' OR '1'='1`로 전체 사용자를 조회하고 `UNION SELECT`로 DB 이름과 버전(`dvwa`, MariaDB), 그리고 `users` 테이블의 계정과 비밀번호 해시를 뽑아냈다.

![전체 사용자 조회](/assets/images/web-attack-detection-lab/attack-sqli-02-all-users.png)

마지막으로 sqlmap을 사용해 `users` 테이블을 덤프했다. sqlmap이 MD5 해시를 사전 대입으로 크래킹해 `password`, `abc123`, `charley`, `letmein` 같은 평문까지 획득했다.

![sqlmap](/assets/images/web-attack-detection-lab/attack-sqlmap-04-dump-users.png)


탐지는 접근 로그의 `uri_query`에서 `union select`, `1=1`, `information_schema`, `sleep(` 같은 SQL Injection 시그니처를 찾는다.

```spl
index=main sourcetype=access_combined host=dvwa
    uri_query="*union*select*"
    OR uri_query="*union+select*"
    OR uri_query="*1=1*"
    OR uri_query="*information_schema*"
    OR uri_query="*sleep(*"
| eval decoded=urldecode(uri_query)
| table _time clientip method uri_path decoded status
| sort -_time
```

시그니처가 포함된 요청만 골라낸 뒤 `urldecode`로 페이로드를 풀고 시간,출발지 IP,메소드, 경로, 디코딩된 페이로드, 응답코드를 표로 출력한다.

![SQL Injection 탐지 결과](/assets/images/web-attack-detection-lab/01_sqli_payloads.png)

`192.168.122.96`에서 `/vulnerabilities/sqli/` 경로로 SQL Injection 요청 43건이 탐지되었다. 디코딩된 페이로드에서 `CONCAT(0x...)`, `INFORMATION_SCHEMA.COLUMNS` 같은 sqlmap 특유의 패턴이 확인되었다. 출발지 IP로 집계하면 43건이 전부 단일 IP `192.168.122.96`에서 발생했고, 응답코드는 200이 15건, 302가 28건이었다.

![SQL Injection 출발지 IP 집계](/assets/images/web-attack-detection-lab/01_sqli_attacker_ip.png)

### 탐지 2 - Reflected XSS

**사용 로그:** Apache access log (`access_combined`)

**분류:** OWASP Cross-Site Scripting (XSS) / CWE-79

DVWA의 Reflected XSS 페이지(`/vulnerabilities/xss_r/`)에 `<script>alert(1)</script>`, `<svg onload=alert(1)>`, `<img src=x onerror=alert(1)>`, `javascript:`를 입력해 스크립트가 실제로 실행되는 것을 확인했다.

![Reflected XSS](/assets/images/web-attack-detection-lab/attack-xss-browser1.png)

`document.cookie`를 출력하는 페이로드도 넣어 봤다. alert 창에 `PHPSESSID`가 그대로 노출됐다.

![XSS 세션 쿠키 노출](/assets/images/web-attack-detection-lab/attack-xss-cookie-theft.png)

탐지는 `uri_query`에서 `<script`, `onerror`, `onload`, `javascript`, `document.cookie` 같은 XSS 시그니처를 찾는다. `<script`는 인코딩된 `%3Cscript` 형태도 함께 본다.

```spl
index=main sourcetype=access_combined host=dvwa
    (uri_query="*<script*"
    OR uri_query="*%3Cscript*"
    OR uri_query="*onerror*"
    OR uri_query="*onload*"
    OR uri_query="*javascript*"
    OR uri_query="*document.cookie*")
| eval decoded=urldecode(uri_query)
| table _time clientip method uri_path decoded status
| sort -_time
```

![XSS 탐지 결과](/assets/images/web-attack-detection-lab/02_xss_payloads.png)

`192.168.122.96`에서 `/vulnerabilities/xss_r/` 경로로 XSS 페이로드가 포함된 요청이 탐지되었다. 디코딩된 페이로드에서 `<script>alert(1)</script>`, `<svg onload=alert(1)>`, `<img src=x onerror=alert(1)>`, `javascript:alert(1)` 가 확인되었다. 룰에는 요청 9건이 매칭됐는데 그중 한 건은 `*<script*`처럼 시그니처를 넓게 잡다 보니 sqlmap이 보낸 `<script>` 문자열이 박힌 SQL인젝션 요청이 함께 걸린 오탐이었다. 실제 XSS는 8건으로 시그니처 폭을 넓히면 그만큼 다른 공격의 흔적까지 매칭된다는 점을 여기서 확인했다.

![XSS 출발지 IP 집계](/assets/images/web-attack-detection-lab/02_xss_attacker_ip.png)

### 탐지 3 - LFI

**사용 로그:** Apache access log (`access_combined`)

**MITRE ATT&CK:** Initial Access / Exploit Public-Facing Application (T1190)

DVWA의 File Inclusion 페이지(`/vulnerabilities/fi/`)의 `page` 파라미터에 `../../../../../etc/passwd`를 넣어 웹 루트 바깥의 파일을 읽었다. 응답으로 `/etc/passwd`가 그대로 출력됐다.

![LFI로 /etc/passwd 노출](/assets/images/web-attack-detection-lab/attack-lfi-browser.png)

탐지는 `uri_query`에서 `../` 경로 순회 패턴과 `/etc/passwd`, `/etc/shadow`, `/proc/self/environ` 같은 민감 경로를 찾는다. URL 인코딩된 형태(`..%2F`, `%2Fetc%2Fpasswd`)도 함께 검색한다.

```spl
index=main sourcetype=access_combined host=dvwa
    (uri_query="*../*" OR uri_query="*..%2F*"
    OR uri_query="*/etc/passwd*" OR uri_query="*%2Fetc%2Fpasswd*"
    OR uri_query="*/etc/shadow*" OR uri_query="*%2Fetc%2Fshadow*"
    OR uri_query="*/proc/self/environ*" OR uri_query="*%2Fproc%2Fself%2Fenviron*")
| stats count by clientip, status
| sort -count
```

![LFI 출발지 IP 집계](/assets/images/web-attack-detection-lab/03_lfi_attacker_ip.png)

`192.168.122.96`에서 `/vulnerabilities/fi/` 경로로 LFI 요청이 탐지되었다. 출발지를 집계하면 전부 단일 IP에서 발생했고 응답코드 200이 4건이었다. 디코딩된 페이로드에서 `../../../../etc/passwd`, `../../../../etc/shadow`, `../../../../proc/self/environ` 등 웹 루트 외부의 파일을 요청하는 패턴이 확인되었다.

### 탐지 4 - Command Injection

**사용 로그:** Apache access log (`access_combined`)

**MITRE ATT&CK:** Execution / Command and Scripting Interpreter (T1059)

DVWA의 Command Injection 페이지(`/vulnerabilities/exec/`)는 입력한 IP로 `ping`을 실행한다. 여기에 셸 메타문자로 명령을 이어 붙였다. `127.0.0.1; whoami; uname -a`처럼 한 번에 여러 명령을 연결하니 정상 ping 결과 뒤에 `www-data` 권한과 커널 정보가 그대로 출력됐다.

![Command Injection](/assets/images/web-attack-detection-lab/attack-cmdi-recon.png)

`127.0.0.1; cat /etc/passwd`로 시스템 계정 목록까지 읽었다.

![Command Injection /etc/passwd](/assets/images/web-attack-detection-lab/attack-cmdi-cat-passwd.png)

탐지 쿼리 처음에는 셸 메타문자(`;` `|` `&&`)만으로 필터링했다.

```spl
index=main sourcetype=access_combined host=dvwa
    (uri_query="*;*" OR uri_query="*%3B*"
    OR uri_query="*|*" OR uri_query="*%7C*"
    OR uri_query="*&&*" OR uri_query="*%26%26*")
| eval decoded=urldecode(uri_query)
| table _time clientip method uri_path decoded status
| sort -_time
```

![Command Injection 탐지](/assets/images/web-attack-detection-lab/04_cmdi_loose.png)

이 경우 32건이 탐지됐는데 메타문자만 포함된 SQL Injection 요청까지 함께 매칭되어 오탐이 생겼다. 그래서(`whoami`, `id`, `uname`, `cat`)가 포함된 경우로 조건을 좁혔다.

```spl
index=main sourcetype=access_combined host=dvwa
    (uri_query="*;cat*" OR uri_query="*;id*" OR uri_query="*;uname*"
     OR uri_query="*%3Bcat*" OR uri_query="*%3Bid*" OR uri_query="*%3Buname*"
     OR uri_query="*whoami*")
| eval decoded=urldecode(uri_query)
| table _time clientip method uri_path decoded status
| sort -_time
```

![Command Injection 탐지2](/assets/images/web-attack-detection-lab/04_cmdi_refined.png)

이렇게 하니 SQLi 오탐이 사라지고 9건으로 줄었다. 마지막으로 긴 `OR` 나열 대신 정규식으로 패턴을 한 줄로 정리했다.

```spl
index=main sourcetype=access_combined host=dvwa
| eval decoded=urldecode(uri_query)
| regex decoded="(?i)(;|\||&&)\s*(whoami|id|uname|cat)(\s|&|$)"
| table _time clientip method uri_path decoded status
| sort -_time
```

![Command Injection 정규식](/assets/images/web-attack-detection-lab/04_cmdi_regex.png)

정규식으로 바꾼 뒤에도 탐지 건수는 9건으로 동일했다.

![Command Injection 출발지 IP 집계](/assets/images/web-attack-detection-lab/04_cmdi_attacker_ip.png)

시간대로 묶어 보면 9건이 6월 9일 오전의 약 5분 단위 두 구간에 몰려 있기 때문에 공격 정황으로 볼 수 있다.

![Command Injection 시간대별](/assets/images/web-attack-detection-lab/04_cmdi_timeline.png)

### 탐지 5 - 파일 업로드 웹쉘

**사용 로그:** Apache access log (`access_combined`), Linux auditd (`webroot_change`)

**MITRE ATT&CK:** Persistence / Server Software Component: Web Shell (T1505.003), Execution / Command and Scripting Interpreter (T1059)

DVWA의 파일 업로드 기능(`/vulnerabilities/upload/`)으로 PHP 웹쉘을 업로드했다. 업로드가 성공하면 서버가 저장 경로(`hackable/uploads/`)를 그대로 알려준다.

![웹쉘 업로드 성공](/assets/images/web-attack-detection-lab/05_upload_success.png)

이후 업로드된 `hackable/uploads/shell.php`에 `?cmd=` 파라미터로 명령을 전달해 `cat /etc/passwd`, `uname -a`, `id` 등을 실행했다. URL로 임의 명령이 실행되는 원격 코드 실행(RCE) 상태다.

![웹쉘로 명령 실행](/assets/images/web-attack-detection-lab/05_webshell_execution.png)

문제는 업로드 요청이 `POST`라서, Apache 접근 로그만으로는 어떤 파일이 올라갔는지 본문을 알 수 없다는 점이다. 접근 로그에는 `POST /vulnerabilities/upload/`라는 사실만 남는다.

```spl
index=main sourcetype=access_combined host=dvwa
| table _time clientip method uri_path status
| sort -_time
```

![업로드 요청 접근 로그](/assets/images/web-attack-detection-lab/05_upload_access_log.png)

그래서 접근 로그의 업로드 요청과 `webroot_change` 같이 사용해 시간순으로 정렬했다.

```spl
index=main host=dvwa
    ((sourcetype=access_combined clientip="192.168.122.96" uri_path="*upload*")
    OR (sourcetype=linux_audit webroot_change))
| table _time sourcetype clientip method uri_path status comm syscall
| sort _time
```

`access_combined`와 `linux_audit`의 파일 생성 이벤트를 한 화면에서 시간순으로 보면 업로드 요청 직후 웹 루트에 파일을 만드는 흐름이 드러난다.

![업로드, 웹쉘 실행 상관분석](/assets/images/web-attack-detection-lab/05_webshell_correlation.png)

`192.168.122.96`의 업로드 요청 직후 웹 루트에 파일이 생성되고 `shell.php`로 `cmd` 명령이 실행되는 흐름이 상관분석으로 확인되었다.

## 인시던트 티켓 정리

탐지로 끝내지 않고 관제 업무처럼 각 탐지를 인시던트 티켓으로 정리했다. 출발지, 대상, 심각도, 정탐오탐 판단, 조치를 한 장씩 기록했다. 다섯 건 모두 단일 공격자 `192.168.122.96`에서 발생한 정탐으로 판단했다.

| 티켓 | 공격 | 심각도 | 판단 | 핵심 조치 |
|---|---|---|---|---|
| TICKET-01 | SQL Injection | High | 정탐 | 출발지 차단, `id` 입력값 검증, DB 계정 비밀번호 재설정 |
| TICKET-02 | Reflected XSS | High | 정탐 | 출력 시 HTML 인코딩, 세션 쿠키에 `HttpOnly`, `Secure` 적용 |
| TICKET-03 | LFI | High | 정탐 | `page` 파라미터 화이트리스트, `../` 문자열 차단 |
| TICKET-04 | Command Injection | High | 정탐 | 출발지 차단, IP 입력값에 셸 메타문자 필터링 |
| TICKET-05 | 파일 업로드 웹쉘 | High | 정탐 | 업로드된 `shell.php` 삭제, 확장자 화이트리스트 적용 |

## 대시보드

개별 쿼리를 매번 돌리는 대신 자주 보는 탐지를 하나의 모니터링 대시보드로 묶었다.

![대시보드](/assets/images/web-attack-detection-lab/07_dashboard.png)

상단에는 공격 유형별 탐지 건수를 단일 값 패널로 설정하고 가운데에는 시간대별 웹 공격 건수를 그래프로, 하단에는 IP별 공격 건수 집계와 응답 코드 분포를 배치했다.