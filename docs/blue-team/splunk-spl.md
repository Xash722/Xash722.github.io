---
title: Splunk SPL
parent: 탐지 / 대응 (Blue Team)
nav_order: 3
---

# Splunk SPL

엔드포인트마다 흩어진 수만 줄의 로그에서 의미 있는 데이터를 찾아내려면 검색 언어가 필요하고 Splunk에서 그 역할을 하는 게 SPL(Search Processing Language)이다.

---

## SPL의 파이프라인 구조

SPL은 파이프(`|`)로 명령끼리 연결한다.

리눅스 쉘의 파이프와 같다. 앞 명령의 결과(이벤트 집합)가 뒤 명령의 입력으로 흘러 들어간다.

```
검색 조건             ← 어떤 로그를 가져올지
| 명령1               ← 가공
| 명령2               ← 집계
| 명령3               ← 정렬,출력
```

맨 앞의 검색 조건에서 범위를 좁힐수록 뒤 명령이 처리할 데이터가 줄어 검색이 빨라진다.

---

## 검색 조건으로 범위 좁히기

파이프 이전, 가장 앞부분이 검색 조건이다. 세 가지를 기억하면 된다.

| 항목 | 역할 | 예시 |
| --- | --- | --- |
| `index` | 어느 인덱스(저장소)에서 찾을지 | `index=main` |
| `source` / `sourcetype` | 어떤 로그 소스인지 | `source="wineventlog:security"` |
| 필드=값 | 특정 필드로 필터 | `EventCode=4625` |


```spl
index=main source="wineventlog:security" EventCode=4625
```

`main` 인덱스의 Windows Security 로그 중 `EventCode`가 4625(로그온 실패)인 이벤트만 가져온다는 뜻이다.

> sourcetype : Splunk가 데이터를 무슨 형식으로 해석할지 정하는 분류. 같은 종류의 로그라도 sourcetype에 따라 추출되는 필드가 달라진다.

조건을 조합할 때 쓰는 연산자는 다음과 같다.

| 연산자 | 의미 | 예시 |
| --- | --- | --- |
| 공백 | AND | `EventCode=4625 Logon_Type=3` |
| `OR` | 둘 중 하나 | `EventCode=4625 OR EventCode=4740` |
| `NOT` / `!=` | 제외 | `NOT DestinationIp="127.0.0.1"` |
| `*` | 와일드카드 | `Image="*\\powershell.exe"` |
| `IN (...)` | 목록 중 하나 | `DestinationIp IN ("127.0.0.1", "0:0:0:0:0:0:0:1")` |

---

## 자주 쓰는 명령어

검색으로 가져온 이벤트를 파이프 뒤에서 가공한다. SOC에서 거의 매번 쓰는 명령어만 추리면 다음과 같다.

| 명령어 | 하는 일 |
| --- | --- |
| `stats` | 집계(개수,고유값,합계 등) |
| `table` | 보고 싶은 필드만 표로 출력 |
| `fields` | 필드를 남기거나 제거 |
| `eval` | 새 필드 계산 / 값 가공 |
| `where` | 집계 결과를 조건으로 거르기 |
| `sort` | 정렬(`-`는 내림차순) |
| `dedup` | 중복 제거 |
| `rename` | 필드 이름 바꾸기 |
| `bin` (`bucket`) | 시간 등을 구간으로 묶기 |
| `top` / `rare` | 가장 많은 / 가장 드문 값 |
| `timechart` | 시간축 기준 집계(그래프용) |

---

## stats

stats는 데이터를 특정 기준으로 묶어 개수, 합계, 평균 같은 통계값으로 요약한다.
SOC에서는 “특정 시간 안에 로그인 실패가 비정상적으로 많다”처럼 이벤트 빈도를 기준으로 이상 징후를 찾는 경우가 많기 때문에 개수를 세는 stats가 핵심적으로 쓰인다.

기본 형태는 `stats <집계함수> BY <기준 필드>`

| 집계 함수 | 의미 |
| --- | --- |
| `count` | 이벤트 개수 |
| `dc(필드)` | 고유값 개수(distinct count) |
| `values(필드)` | 그룹에 등장한 값들의 목록(중복 제거) |
| `count(eval(조건))` | 조건을 만족하는 이벤트만 센다 |
| `latest` / `earliest` | 가장 최근 / 가장 이른 값 |

예를 들어 이 쿼리는

```spl
index=main EventCode=4625
| stats count AS fail_count, dc(Account_Name) AS unique_accounts BY Source_Network_Address
```

출발지 IP별로 로그온 실패가 몇 번 일어났고 몇 개의 서로 다른 계정을 노렸는지를 한 줄로 요약한다. `AS`로 결과 필드의 이름을 알아보기 쉽게 바꿀 수 있다.

---

## eval과 where

`eval`은 새 필드를 만들거나 값을 가공하고 `where`는 그 결과를 조건으로 필터링한다.

```spl
index=main EventCode=4625
| stats count AS fail_count BY Source_Network_Address
| where fail_count >= 5
```

`stats`로 IP별 실패 횟수를 센 다음, 5회 이상인 IP만 남긴다. 임계치를 설정하는 게 바로 이 `where`다.

`eval`은 값을 다듬을 때 쓴다.

```spl
| eval target_account=mvfilter(Account_Name!="-" AND Account_Name!="")
```

Windows 이벤트에는 의미 없는 빈 값(`"-"`, `""`)이 섞여 들어오는데, 이를 걸러 깨끗한 계정 값만 `target_account`로 만든다.

---

## bin 시간 구간 설정

짧은 시간에 몰리는 패턴은 의심해야한다. 정상 사용자는 비밀번호를 짧은 시간 안에 많이 틀리지 않는다. 이때 `bin`으로 `_time`을 일정 구간으로 묶는다.

> _time : Splunk가 모든 이벤트에 자동으로 붙이는 시간 필드.

```spl
| bin _time span=5m
| stats count BY _time, Source_Network_Address
```

`_time`을 5분 단위로 깎아낸 뒤 그 구간,IP별로 개수를 센다. `span=1h`이나 `span=1d`처럼 구간을 바꿀 수 있다. 이렇게 하면 "특정 구간에 한 IP에서 실패가 몰렸다"를 잡아낼 수 있다.

---

## 랩 탐지 쿼리 예시

[Splunk Windows SOC 탐지 Lab]({% link docs/Projects/SIEM_Projects.md %})에서 쓴 실제 탐지 쿼리를 살펴보자.

### Brute Force 탐지

```spl
index=main source="wineventlog:security" EventCode=4625 Logon_Type=3
| eval target_account=mvfilter(Account_Name!="-" AND Account_Name!="")
| bin _time span=5m
| stats count AS fail_count, dc(target_account) AS unique_accounts, values(target_account) AS targeted_accounts BY _time, Source_Network_Address
| where fail_count >= 5
```

한 줄씩 보면 이렇게 읽힌다.

| 줄 | 항목 | 의미 |
| --- | --- | --- |
| 1 | 검색 조건 | 네트워크 로그온의 실패(4625)만 가져온다 |
| 2 | `eval` | 빈 계정 값을 필터링한다 |
| 3 | `bin` | 5분 단위로 시간을 묶는다 |
| 4 | `stats` | 구간,IP별 실패 횟수,노린 계정 수,계정 목록을 집계 |
| 5 | `where` | 5회 이상 실패한 구간만 남긴다 |


### Discovery 명령어 탐지

```spl
index=main source="xmlwineventlog:microsoft-windows-sysmon/operational" EventCode=1
    (Image="*\\whoami.exe" OR Image="*\\ipconfig.exe" OR Image="*\\net.exe"
     OR Image="*\\net1.exe" OR Image="*\\nltest.exe" OR Image="*\\systeminfo.exe")
| bin _time span=5m
| stats count AS cmd_count, values(CommandLine) AS commands BY _time, ParentImage
| where cmd_count >= 3
| sort _time
```

여기서는 Sysmon 프로세스 생성(`EventCode 1`) 중 정보 수집에 쓰이는 명령들만 `OR`로 모은 뒤, 부모 프로세스(`ParentImage`)별로 묶어 3개 이상 몰린 구간을 잡는다. 개별 `whoami` 한 번은 정상일 수 있지만, PowerShell 하나가 5분 안에 `whoami`,`net`,`ipconfig`를 연달아 실행하면 의심스럽다. 그 "묶음"을 `stats ... BY ParentImage`가 만들어 준다.

---
