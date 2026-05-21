import { ethers } from "https://esm.sh/ethers@6.13.4";
import EthereumProvider from "https://esm.sh/@walletconnect/ethereum-provider@2.17.2";

export const CONTRACT_ADDRESS = "PASTE_CONTRACT_ADDRESS_HERE";
export const PROJECT_ID = "fe55ea601c3e7e0925c0b33723d6b158";
export const ABI = ["function mint(uint256 amount) external payable","function PRICE() view returns (uint256)","function minted(address user) view returns (uint256)","function totalSupply() view returns (uint256)","function tokenURI(uint256 tokenId) view returns (string)"];
export const MAINNET_HEX="0x1", MAINNET_ID=1, MAX_SUPPLY=10000, DEFAULT_PRICE_ETH="0.0001";

let wcProvider=null, provider=null, signer=null, contract=null, account=null, cachedPriceWei=null, cachedAlreadyMinted=0n;
const $=id=>document.getElementById(id);
const walletEl=$("wallet"), statusEl=$("status"), amountInput=$("amountInput"), progressBar=$("progressBar"), mintedText=$("mintedText"), priceText=$("priceText"), galleryEl=$("gallery"), openseaLink=$("openseaLink"), etherscanLink=$("etherscanLink"), walletModal=$("walletModal");
const balanceEl=$("balanceText"), mintedByWalletEl=$("mintedByWalletText"), networkEl=$("networkText"), floorEl=$("floorText");
const terminalEl=$("animatedTerminal");

function status(m){ if(statusEl) statusEl.textContent=m }
function openModal(){ walletModal?.classList.remove("hidden") }
function closeModal(){ walletModal?.classList.add("hidden") }
export function ipfsToHttp(u){return u&&u.startsWith("ipfs://")?"https://ipfs.io/ipfs/"+u.replace("ipfs://",""):u}
function getAmount(){ if(!amountInput) return 1; let a=Number(amountInput.value);if(!Number.isInteger(a)||a<1)a=1;if(a>30)a=30;amountInput.value=a;return a}
function setLinks(){if(CONTRACT_ADDRESS!=="PASTE_CONTRACT_ADDRESS_HERE"){ if(etherscanLink) etherscanLink.href=`https://etherscan.io/address/${CONTRACT_ADDRESS}`; if(openseaLink) openseaLink.href=`https://opensea.io/assets/ethereum/${CONTRACT_ADDRESS}` }}

async function setupProvider(eip1193Provider, selectedAccount){
  provider=new ethers.BrowserProvider(eip1193Provider);
  signer=await provider.getSigner();
  account=selectedAccount||await signer.getAddress();
  contract=new ethers.Contract(CONTRACT_ADDRESS,ABI,signer);
  localStorage.setItem("asciipunks_last_wallet","connected");
  if(walletEl) walletEl.textContent=account.slice(0,6)+"..."+account.slice(-4);
  status("Connected"); setLinks(); closeModal();
  await loadNetwork(); await loadBalance(); await loadMintedByWallet(); await loadProgress(); await refreshPrice(); await loadOpenSeaFloor();
}

async function connectBrowserWallet(){
  try{
    if(CONTRACT_ADDRESS==="PASTE_CONTRACT_ADDRESS_HERE")throw new Error("Встав адресу контракту в app.js");
    if(!window.ethereum)throw new Error("MetaMask/Rabby extension not found");
    const chainId=await window.ethereum.request({method:"eth_chainId"});
    if(chainId!==MAINNET_HEX) await switchToEthereum();
    const accounts=await window.ethereum.request({method:"eth_requestAccounts"});
    await setupProvider(window.ethereum,accounts[0]);
  }catch(e){console.error(e);status("Error: "+(e.shortMessage||e.message))}
}

async function connectWalletConnect(){
  try{
    if(CONTRACT_ADDRESS==="PASTE_CONTRACT_ADDRESS_HERE")throw new Error("Встав адресу контракту в app.js");
    wcProvider=await EthereumProvider.init({projectId:PROJECT_ID,chains:[MAINNET_ID],optionalChains:[MAINNET_ID],showQrModal:true,metadata:{name:"AsciiPunks",description:"AsciiPunks mint site",url:window.location.origin,icons:[window.location.origin+"/assets/preview1.jpeg"]}});
    await wcProvider.connect();
    await setupProvider(wcProvider,(wcProvider.accounts||[])[0]);
    wcProvider.on("accountsChanged",async(accounts)=>{if(accounts&&accounts[0])await setupProvider(wcProvider,accounts[0])});
    wcProvider.on("disconnect",disconnectWallet);
  }catch(e){console.error(e);status("Error: "+(e.shortMessage||e.message))}
}

async function disconnectWallet(){
  try{if(wcProvider)await wcProvider.disconnect()}catch(e){}
  wcProvider=null;provider=null;signer=null;contract=null;account=null;cachedPriceWei=null;cachedAlreadyMinted=0n;localStorage.removeItem("asciipunks_last_wallet");
  if(walletEl) walletEl.textContent="not connected"; status("Disconnected"); await refreshPrice();
}
async function switchToEthereum(){ if(window.ethereum) await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:MAINNET_HEX}]}) }
async function loadNetwork(){ try{ if(!provider||!networkEl)return; const n=await provider.getNetwork(); networkEl.textContent = n.chainId===1n ? "Ethereum Mainnet" : "Wrong network: " + n.chainId.toString(); }catch(e){}}
async function loadBalance(){ try{ if(!provider||!account||!balanceEl)return; balanceEl.textContent = Number(ethers.formatEther(await provider.getBalance(account))).toFixed(4)+" ETH"; }catch(e){}}
async function loadMintedByWallet(){ try{ if(!contract||!account||!mintedByWalletEl)return; mintedByWalletEl.textContent = (await contract.minted(account)).toString(); }catch(e){}}
async function loadOpenSeaFloor(){ if(floorEl) floorEl.textContent="OpenSea API required"; }

async function refreshPrice(){
  try{
    if(!priceText) return;
    const amount=BigInt(getAmount());
    if(contract&&account){cachedAlreadyMinted=await contract.minted(account);cachedPriceWei=await contract.PRICE()}
    if(!cachedPriceWei){priceText.textContent=amount===1n?"FREE":(Number(amount-1n)*Number(DEFAULT_PRICE_ETH)).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+" ETH";return}
    let paid=amount;if(cachedAlreadyMinted===0n)paid=paid>0n?paid-1n:0n;
    priceText.textContent=paid===0n?"FREE":ethers.formatEther(cachedPriceWei*paid)+" ETH";
  }catch(e){}
}
async function loadProgress(){ if(!contract||!mintedText||!progressBar)return; const m=Number(await contract.totalSupply()); mintedText.textContent=m+" / "+MAX_SUPPLY; progressBar.style.width=Math.min(100,m/MAX_SUPPLY*100)+"%"}
async function mint(){
  try{
    if(!contract){status("Connect wallet first");return}
    const amount=getAmount(), already=await contract.minted(account), price=await contract.PRICE(); let paid=BigInt(amount); if(already===0n)paid=paid>0n?paid-1n:0n;
    status("Confirm mint in wallet..."); const tx=await contract.mint(amount,{value:price*paid}); status("Transaction sent: "+tx.hash); await tx.wait(); status("Mint success!");
    await loadProgress(); await refreshPrice(); await loadMintedByWallet(); await loadBalance(); await loadGallery(); await loadActivity();
  }catch(e){console.error(e);status("Error: "+(e.shortMessage||e.message))}
}
async function loadGallery(){
  try{
    if(!contract||!galleryEl)return;
    galleryEl.innerHTML="<p class='galleryNote'>Loading minted NFTs...</p>";
    const supply=Number(await contract.totalSupply()); if(supply===0){galleryEl.innerHTML="<p class='galleryNote'>No minted NFTs yet.</p>";return}
    const ids=[]; for(let i=supply-1;i>=Math.max(0,supply-20);i--)ids.push(i);
    const cards=await Promise.all(ids.map(async id=>{try{const uri=await contract.tokenURI(id),meta=await(await fetch(ipfsToHttp(uri))).json(),img=ipfsToHttp(meta.image),name=meta.name||("AsciiPunk #"+id);return `<article class="nftCard"><img src="${img}" alt="${name}"><div>${name}<small>Token #${id}</small></div></article>`}catch(e){return `<article class="nftCard"><div>Token #${id}<small>Metadata loading...</small></div></article>`}}));
    galleryEl.innerHTML=cards.join("");
  }catch(e){ if(galleryEl) galleryEl.innerHTML="<p class='galleryNote'>Gallery error</p>"}
}
async function loadActivity(){
  const activityEl=$("activityFeed"); if(!activityEl||!contract)return;
  const supply=Number(await contract.totalSupply()); const items=[]; for(let i=supply-1;i>=Math.max(0,supply-15);i--)items.push(`<p>Minted token #${i} • live contract feed</p>`);
  activityEl.innerHTML=items.join("")||"<p>No activity yet</p>";
}
function rarityScore(id){ const x=(id*9301+49297)%233280; const r=x%100; if(r<5)return["Legendary",95+r]; if(r<18)return["Epic",80+r]; if(r<40)return["Rare",60+r]; if(r<70)return["Uncommon",35+r]; return["Common",r];}
async function loadRarity(){
  const rarityEl=$("rarityList"); if(!rarityEl)return;
  const rows=[]; for(let i=0;i<20;i++){ const [name,score]=rarityScore(i); rows.push(`<div class="rarityItem"><span>#${i} ${name}</span><b>${score}</b></div>`)}
  rarityEl.innerHTML=rows.join("");
}
function animateTerminal(){
  if(!terminalEl)return;
  const lines=["> booting ascii.exe","> scanning wallets...","> first mint = free","> next mint = 0.0001 ETH","> signal detected ███"];
  let i=0; setInterval(()=>{terminalEl.innerHTML += `<p>${lines[i%lines.length]}</p>`; terminalEl.scrollTop=terminalEl.scrollHeight; i++;},1400);
}
function setupEvents(){
  $("connectWalletBtn")?.addEventListener("click",openModal); $("closeModalBtn")?.addEventListener("click",closeModal); $("browserWalletBtn")?.addEventListener("click",connectBrowserWallet); $("walletConnectBtn")?.addEventListener("click",connectWalletConnect); $("disconnectBtn")?.addEventListener("click",disconnectWallet); $("mintBtn")?.addEventListener("click",mint); $("loadGalleryBtn")?.addEventListener("click",loadGallery); $("loadActivityBtn")?.addEventListener("click",loadActivity); $("switchNetworkBtn")?.addEventListener("click",switchToEthereum);
  $("minusBtn")?.addEventListener("click",async()=>{amountInput.value=Math.max(1,Number(amountInput.value||1)-1);await refreshPrice()}); $("plusBtn")?.addEventListener("click",async()=>{amountInput.value=Math.min(30,Number(amountInput.value||1)+1);await refreshPrice()}); if(amountInput) amountInput.oninput=refreshPrice;
  document.querySelectorAll(".thumbs img").forEach(img=>{img.onclick=()=>{const main=$("mainImg"); if(main) main.src=img.dataset.img; document.querySelectorAll(".thumbs img").forEach(x=>x.classList.remove("active")); img.classList.add("active")}})
}
setupEvents(); refreshPrice(); setLinks(); animateTerminal(); loadRarity();
setInterval(()=>{loadProgress();loadActivity()},15000);
if(localStorage.getItem("asciipunks_last_wallet")&&window.ethereum){connectBrowserWallet();}
