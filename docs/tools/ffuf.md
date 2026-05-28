---
title: ffuf
parent: Tools
nav_order: 1
---

# ffuf

디렉토리 및 파라미터 퍼징/무차별 대입 공격에 많이 쓰이는 도구 중 하나이다.

다음과 같은 용도로 사용할 수 있다.

- 디렉토리 퍼징
- 파일 및 확장자 퍼징
- 숨겨진 가상 호스트(vhost) 식별
- php 파라미터 퍼징
- 파라미터 이름 퍼징 (GET/POST/JSON 등)
- 파라미터 값 퍼징

웹 사이트에 단서가 없으면 숨겨진 디렉터리와 페이지를 찾기 위해 퍼징을 한다.

ffuf는 초당 수백 건의 요청을 보내 응답 코드에 따라 존재 여부를 판별한다.

ffuf에는 워드리스트가 필요하며 주로 SecLists를 사용한다.

> 해당 워드리스트 앞부분의 주석/저작권 문구는 결과를 지저분하게 만들 수 있기 때문에 `-ic` 옵션을 사용해서 제거한다.



| 작업                              | SecLists 워드리스트                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1) 디렉토리/페이지(엔드포인트) 퍼징           | `Discovery/Web-Content/common.txt`<br>`Discovery/Web-Content/raft-small-directories.txt`<br>`Discovery/Web-Content/raft-medium-directories.txt`<br>`Discovery/Web-Content/raft-medium-directories-lowercase.txt` (대상 경로가 소문자 위주일 때)                                                                                    |
| 2) 파일명 퍼징                       | `Discovery/Web-Content/raft-small-files.txt`<br>`Discovery/Web-Content/raft-medium-files.txt`                                                                                                                                                                                                                          |
| 3) 확장자 퍼징                       | `Discovery/Web-Content/web-extensions.txt`<br>`Discovery/Web-Content/raft-small-extensions.txt`<br>`Discovery/Web-Content/raft-medium-extensions.txt`                                                                                                                                                                  |
| 4) VHOST(Host 헤더) / 서브도메인 후보 퍼징 | `Discovery/DNS/subdomains-top1million-5000.txt` → `...-20000.txt` → `...-110000.txt`                                                                                                                                                                                                                                   |
| 5) 파라미터 이름 퍼징                   | `Discovery/Web-Content/burp-parameter-names.txt`                                                                                                                                                                                                                                                                       |
| 6) 파라미터 값 퍼징(목적별)               | (코드/핀/OTP) `Fuzzing/4-digits-0000-9999.txt` → `Fuzzing/5-digits-00000-99999.txt` → `Fuzzing/6-digits-000000-999999.txt` <br>(LFI/경로탐색) `Fuzzing/LFI/LFI-Jhaddix.txt` <br>(XSS/URI 컨텍스트) `Fuzzing/URI-XSS.fuzzdb.txt` <br>(JSON 입력) `Fuzzing/JSON.Fuzzing.txt` <br>(범용 엣지케이스) `Fuzzing/big-list-of-naughty-strings.txt` |
| 7) API 엔드포인트 퍼징                 | `Discovery/Web-Content/common-api-endpoints-mazen160.txt`<br>`Discovery/Web-Content/api/api-endpoints.txt`                                                                                                                                                                                                             |


## 디렉토리 퍼징

핵심 옵션 두 가지는 워드 리스트를 지정하는 `-w`와 url을 지정하는 `-u`

퍼징을 수행하고 싶은 위치에서 특정 워드리스트를 특정 키워드에 할당 할 수 있다.

```
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt:FUZZ
```

FUZZ라는 키워드에 common.txt를 할당했다.
만약 웹 디렉터리 대상으로 퍼징을 하고 싶다면 URL에서 퍼징을 하고 싶은 위치에 FUZZ 키워드를 넣으면 된다.

```
ffuf -w <워드리스트> -u http://ip주소:포트번호/FUZZ
```

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/tools/ffuf/1_directory.png' | relative_url }}" style="width:700px;">
    <figcaption>디렉토리 퍼징</figcaption>
</figure>
<br>

blog와 forum을 발견했다.

## 확장자 퍼징

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/tools/ffuf/2_page.png' | relative_url }}" style="width:700px;">
    <figcaption>디렉토리 퍼징</figcaption>
</figure>
<br>

위에서 발견함 blog와 forum에 가보면 아무것도 나오지 않는 것을 볼 수 있다.
이번엔 웹 페이지의 확장자 퍼징으로 해당 디렉터리에 숨겨진 페이지가 있는지 확인해본다.
대부분의 웹 사이트에 존재하는 index 파일을 이용해서 확장자를 찾아본다
이번엔 확장자가 들어갈 위치에 FUZZ를 넣으면 된다.
확장자 퍼징에 쓰이는 워드리스트에는 `.`이 포함되어 있으므로 FUZZ 앞에 `.`을 따로 추가할 필요 없다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/tools/ffuf/3_extension.png' | relative_url }}" style="width:700px;">
    <figcaption>확장자 퍼징</figcaption>
</figure>
<br>

PHP만 상태코드 200이 나온다.
그럼 이제 웹 사이트가 php로 동작한다는 정보를 얻었으니 php 파일을 대상으로 퍼징을 하면 된다.

## 페이지 퍼징

확장자가 php라는 것을 알았으니, 이번엔 디렉터리 안에 어떤 php 페이지가 있는지 찾는다.
페이지 이름이 들어갈 위치에 FUZZ를 넣고 뒤에 `.php`를 붙인 뒤, 파일명 워드리스트를 할당한다.

```
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-files.txt:FUZZ -u http://ip주소:포트번호/FUZZ.php
```

확장자 퍼징과 달리 워드리스트에는 `.`이 없으므로 FUZZ 뒤에 `.php`를 직접 붙여야 한다.
특정 디렉터리 안을 찾고 싶다면 `http://ip주소:포트번호/디렉터리/FUZZ.php` 처럼 경로를 지정하면 된다.

## VHOST 퍼징

하나의 IP에 여러 웹 사이트가 올라가 있는 경우, 서버는 요청의 `Host` 헤더를 보고 어떤 사이트를 보여줄지 결정한다.
즉 IP는 같아도 `Host` 헤더에 들어가는 도메인에 따라 다른 페이지가 응답될 수 있다.
이렇게 겉으로 드러나지 않는 가상 호스트(vhost)를 찾기 위해 `Host` 헤더 값을 퍼징한다.

먼저 대상 도메인을 `/etc/hosts`에 등록해 해당 IP로 향하도록 해둔다.

```
ffuf -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ -u http://대상도메인:포트번호/ -H "Host: FUZZ.대상도메인"
```

`-H` 옵션으로 헤더를 지정하고, `Host` 헤더에서 서브도메인이 들어갈 위치에 FUZZ를 넣는다.

> 존재하지 않는 vhost도 서버는 기본 페이지를 200으로 돌려주는 경우가 많다.
> 그래서 모든 결과가 200으로 보이는데, 이때는 기본 응답의 크기(size)나 단어 수(word)를 `-fs`, `-fw` 옵션으로 걸러내야 진짜 다른 vhost만 남는다.

```
ffuf -w <워드리스트>:FUZZ -u http://대상도메인:포트번호/ -H "Host: FUZZ.대상도메인" -fs <기본응답크기>
```

## 파라미터 이름 퍼징

페이지가 어떤 파라미터를 받는지 모를 때, 파라미터 이름 자체를 퍼징해서 숨겨진 입력값을 찾는다.

GET 방식은 URL 쿼리스트링의 파라미터 이름 위치에 FUZZ를 넣는다.

```
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ -u http://ip주소:포트번호/페이지.php?FUZZ=key -fs <기본응답크기>
```

POST 방식은 `-X POST`로 메서드를 바꾸고, `-d`로 본문 데이터에 FUZZ를 넣는다.
폼 데이터로 보낼 때는 `Content-Type` 헤더도 함께 지정한다.

```
ffuf -w <워드리스트>:FUZZ -u http://ip주소:포트번호/페이지.php -X POST -d "FUZZ=key" -H "Content-Type: application/x-www-form-urlencoded" -fs <기본응답크기>
```

여기서도 존재하지 않는 파라미터는 동일한 크기의 응답이 돌아오므로, `-fs`로 기본 응답을 걸러내면 유효한 파라미터만 남길 수 있다.

## 파라미터 값 퍼징

파라미터 이름을 알아냈다면, 이번엔 그 파라미터에 들어갈 값을 퍼징한다.
예를 들어 `id` 같은 숫자형 파라미터라면 숫자 워드리스트를 사용한다.

```
ffuf -w /usr/share/wordlists/seclists/Fuzzing/4-digits-0000-9999.txt:FUZZ -u http://ip주소:포트번호/페이지.php -X POST -d "id=FUZZ" -H "Content-Type: application/x-www-form-urlencoded" -fs <기본응답크기>
```

유효하지 않은 값은 같은 응답을 돌려주므로, 마찬가지로 `-fs`/`-fc` 등으로 기본 응답을 걸러내면 의미 있는 값만 남는다.

## 자주 쓰는 옵션 정리

| 옵션 | 설명 |
| --- | --- |
| `-w` | 워드리스트 지정 (`파일:FUZZ` 형식으로 키워드 할당) |
| `-u` | 대상 URL (FUZZ 위치 지정) |
| `-H` | 요청 헤더 지정 (VHOST 퍼징 시 `Host` 헤더 등) |
| `-X` | HTTP 메서드 지정 (`POST` 등) |
| `-d` | POST 본문 데이터 |
| `-ic` | 워드리스트의 주석/저작권 줄 무시 |
| `-mc` | 특정 상태코드만 매칭 (match code) |
| `-fc` | 특정 상태코드 제외 (filter code) |
| `-fs` | 특정 응답 크기 제외 (filter size) |
| `-fw` | 특정 단어 수 제외 (filter word) |
| `-recursion` | 발견한 디렉터리를 따라 들어가며 재귀 퍼징 |

퍼징의 핵심은 결국 **"정상(기본) 응답을 걸러내고 다른 응답만 남기는 것"**이다.
`-fs`, `-fc`, `-fw`로 기본 응답을 제거하고, `-mc`로 원하는 상태코드만 남기면 결과를 훨씬 깔끔하게 볼 수 있다.



