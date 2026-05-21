import { createAppKit } from "https://esm.sh/@reown/appkit@1.8.19";
import { EthersAdapter } from "https://esm.sh/@reown/appkit-adapter-ethers@1.8.19";
import { mainnet } from "https://esm.sh/@reown/appkit/networks";
import { ethers } from "https://esm.sh/ethers@6.13.4";

const CONTRACT_ADDRESS = "0xbE117E1d7332f1834afe826c2069d9499aC1Eef6";
const PROJECT_ID = "fe55ea601c3e7e0925c0b33723d6b158";

const ABI = [
  "function mint(uint256 amount) external payable",
  "function PRICE() view returns (uint256)",
  "function minted(address user) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

const MAX_SUPPLY = 10000, DEFAULT_PRICE_ETH = "0.0001";
const modal = createAppKit({adapters:[new EthersAdapter()],networks:[mainnet],defaultNetwork:mainnet,projectId:PROJECT_ID,metadata:{name:"AsciiPunks",description:"AsciiPunks mint site",url:window.location.origin,icons:[window.location.origin+"/assets/preview1.jpeg"]},features:{analytics:false,email:false,socials:false},themeMode:"dark"});

let provider=null, signer=null, contract=null, account=null, cachedPriceWei=null, cachedAlreadyMinted=0n;
const $=id=>document.getElementById(id);
const connectWalletBtn=$("connectWalletBtn"),walletEl=$("wallet"),statusEl=$("status"),amountInput=$("amountInput"),progressBar=$("progressBar"),mintedText=$("mintedText"),priceText=$("priceText"),galleryEl=$("gallery"),openseaLink=$("openseaLink"),etherscanLink=$("etherscanLink");
function status(m){statusEl.textContent=m}
function ipfsToHttp(u){return u&&u.startsWith("ipfs://")?"https://ipfs.io/ipfs/"+u.replace("ipfs://",""):u}
function getAmount(){let a=Number(amountInput.value);if(!Number.isInteger(a)||a<1)a=1;if(a>30)a=30;amountInput.value=a;return a}
function setLinks(){if(CONTRACT_ADDRESS!=="PASTE_CONTRACT_ADDRESS_HERE"){etherscanLink.href=`https://etherscan.io/address/${CONTRACT_ADDRESS}`;openseaLink.href=`https://opensea.io/assets/ethereum/${CONTRACT_ADDRESS}`}}

async function syncWallet(){
 try{
  const address=modal.getAddress(), wp=modal.getWalletProvider();
  if(!address||!wp){account=null;provider=null;signer=null;contract=null;cachedPriceWei=null;cachedAlreadyMinted=0n;walletEl.textContent="not connected";connectWalletBtn.textContent="Connect Wallet";await refreshPrice();return}
  if(CONTRACT_ADDRESS==="PASTE_CONTRACT_ADDRESS_HERE") throw new Error("Встав адресу контракту в app.js");
  provider=new ethers.BrowserProvider(wp); signer=await provider.getSigner(); account=address; contract=new ethers.Contract(CONTRACT_ADDRESS,ABI,signer);
  walletEl.textContent=account.slice(0,6)+"..."+account.slice(-4); connectWalletBtn.textContent="Wallet Connected"; status("Connected"); setLinks(); await loadProgress(); await refreshPrice();
 }catch(e){console.error(e);status("Error: "+(e.shortMessage||e.message))}
}
async function openConnectModal(){modal.open({view:account?"Account":"Connect"});setTimeout(syncWallet,1000);setTimeout(syncWallet,2500)}
modal.subscribeProvider(syncWallet);modal.subscribeAccount(syncWallet);setTimeout(syncWallet,800);

async function refreshPrice(){
 try{
  const amount=BigInt(getAmount());
  if(contract&&account){cachedAlreadyMinted=await contract.minted(account);cachedPriceWei=await contract.PRICE()}
  if(!cachedPriceWei){priceText.textContent=amount===1n?"FREE":(Number(amount-1n)*Number(DEFAULT_PRICE_ETH)).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+" ETH";return}
  let paid=amount;if(cachedAlreadyMinted===0n)paid=paid>0n?paid-1n:0n;
  priceText.textContent=paid===0n?"FREE":ethers.formatEther(cachedPriceWei*paid)+" ETH";
 }catch(e){console.error(e)}
}
async function loadProgress(){if(!contract)return;const m=Number(await contract.totalSupply());mintedText.textContent=m+" / "+MAX_SUPPLY;progressBar.style.width=Math.min(100,m/MAX_SUPPLY*100)+"%"}
async function mint(){
 try{
  await syncWallet(); if(!contract){status("Connect wallet first");return}
  const amount=getAmount(), already=await contract.minted(account), price=await contract.PRICE(); let paid=BigInt(amount); if(already===0n)paid=paid>0n?paid-1n:0n;
  status("Confirm mint in wallet..."); const tx=await contract.mint(amount,{value:price*paid}); status("Transaction sent: "+tx.hash); await tx.wait(); status("Mint success!"); await loadProgress(); await refreshPrice(); await loadGallery();
 }catch(e){console.error(e);status("Error: "+(e.shortMessage||e.message))}
}
async function loadGallery(){
 try{
  await syncWallet(); if(!contract){status("Connect wallet first");return}
  galleryEl.innerHTML="<p class='galleryNote'>Loading minted NFTs...</p>"; const supply=Number(await contract.totalSupply()); if(supply===0){galleryEl.innerHTML="<p class='galleryNote'>No minted NFTs yet.</p>";return}
  const ids=[];for(let i=supply-1;i>=Math.max(0,supply-20);i--)ids.push(i);
  const cards=await Promise.all(ids.map(async id=>{try{const uri=await contract.tokenURI(id), meta=await(await fetch(ipfsToHttp(uri))).json(), img=ipfsToHttp(meta.image), name=meta.name||("AsciiPunk #"+id);return `<article class="nftCard"><img src="${img}" alt="${name}"><div>${name}<small>Token #${id}</small></div></article>`}catch(e){return `<article class="nftCard"><div>Token #${id}<small>Metadata loading...</small></div></article>`}}));
  galleryEl.innerHTML=cards.join("");
 }catch(e){galleryEl.innerHTML="<p class='galleryNote'>Gallery error: "+(e.shortMessage||e.message)+"</p>"}
}
connectWalletBtn.onclick=openConnectModal;$("mintBtn").onclick=mint;$("loadGalleryBtn").onclick=loadGallery;$("minusBtn").onclick=async()=>{amountInput.value=Math.max(1,Number(amountInput.value||1)-1);await refreshPrice()};$("plusBtn").onclick=async()=>{amountInput.value=Math.min(30,Number(amountInput.value||1)+1);await refreshPrice()};amountInput.oninput=refreshPrice;refreshPrice();setLinks();
document.querySelectorAll(".thumbs img").forEach(img=>{img.onclick=()=>{$("mainImg").src=img.dataset.img;document.querySelectorAll(".thumbs img").forEach(x=>x.classList.remove("active"));img.classList.add("active")}})
