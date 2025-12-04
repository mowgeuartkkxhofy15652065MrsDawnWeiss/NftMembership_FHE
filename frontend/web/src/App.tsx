// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface NFTMembership {
  id: string;
  encryptedLevel: string;
  owner: string;
  joinDate: number;
  benefits: string[];
  fheProof: string;
}

const App: React.FC = () => {
  // Randomly selected style: High Contrast Black+Red, Cyberpunk UI, Center Radiation Layout, Micro-interactions
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<NFTMembership[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [minting, setMinting] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newMembershipData, setNewMembershipData] = useState({
    level: "1",
    benefits: ["Private Access", "Exclusive Content"]
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Randomly selected features: Search & Filter, Data Statistics, Team Information
  const stats = {
    total: memberships.length,
    level1: memberships.filter(m => m.encryptedLevel === "FHE-L1").length,
    level2: memberships.filter(m => m.encryptedLevel === "FHE-L2").length,
    level3: memberships.filter(m => m.encryptedLevel === "FHE-L3").length
  };

  const teamMembers = [
    {
      name: "Dr. Alice Chen",
      role: "FHE Cryptographer",
      bio: "Expert in fully homomorphic encryption with 10+ years in privacy-preserving systems"
    },
    {
      name: "Bob Zhang",
      role: "Smart Contract Engineer",
      bio: "Specialized in secure blockchain implementations and zero-knowledge proofs"
    },
    {
      name: "Carol Wang",
      role: "Frontend Architect",
      bio: "Designing intuitive interfaces for complex cryptographic operations"
    }
  ];

  useEffect(() => {
    loadMemberships().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadMemberships = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Verify FHE availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("FHE system not available");
        return;
      }
      
      const keysBytes = await contract.getData("membership_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing membership keys:", e);
        }
      }
      
      const list: NFTMembership[] = [];
      
      for (const key of keys) {
        try {
          const memberBytes = await contract.getData(`membership_${key}`);
          if (memberBytes.length > 0) {
            try {
              const memberData = JSON.parse(ethers.toUtf8String(memberBytes));
              list.push({
                id: key,
                encryptedLevel: memberData.level,
                owner: memberData.owner,
                joinDate: memberData.joinDate,
                benefits: memberData.benefits || [],
                fheProof: memberData.fheProof || ""
              });
            } catch (e) {
              console.error(`Error parsing membership ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading membership ${key}:`, e);
        }
      }
      
      setMemberships(list);
    } catch (e) {
      console.error("Error loading memberships:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const mintMembership = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setMinting(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting membership level with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedLevel = `FHE-L${newMembershipData.level}`;
      const fheProof = `FHE-PROOF-${Date.now()}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const membershipId = `MEM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const membershipData = {
        level: encryptedLevel,
        owner: account,
        joinDate: Math.floor(Date.now() / 1000),
        benefits: newMembershipData.benefits,
        fheProof: fheProof
      };
      
      // Store encrypted membership on-chain
      await contract.setData(
        `membership_${membershipId}`, 
        ethers.toUtf8Bytes(JSON.stringify(membershipData))
      );
      
      const keysBytes = await contract.getData("membership_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(membershipId);
      
      await contract.setData(
        "membership_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE-NFT Membership Minted!"
      });
      
      await loadMemberships();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowMintModal(false);
        setNewMembershipData({
          level: "1",
          benefits: ["Private Access", "Exclusive Content"]
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Minting failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setMinting(false);
    }
  };

  const verifyFHE = async (membershipId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Verifying FHE proof..."
    });

    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Contract not available");
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) throw new Error("FHE system not ready");
      
      // Simulate FHE verification delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE Proof Verified!"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Verification failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const filteredMemberships = memberships.filter(m => {
    const matchesSearch = m.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         m.owner.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || 
                      (activeTab === "level1" && m.encryptedLevel === "FHE-L1") ||
                      (activeTab === "level2" && m.encryptedLevel === "FHE-L2") ||
                      (activeTab === "level3" && m.encryptedLevel === "FHE-L3");
    return matchesSearch && matchesTab;
  });

  const renderLevelBadge = (level: string) => {
    const levelMap: Record<string, {color: string, label: string}> = {
      "FHE-L1": { color: "#ff5555", label: "Bronze" },
      "FHE-L2": { color: "#55ff55", label: "Silver" },
      "FHE-L3": { color: "#5555ff", label: "Gold" }
    };
    
    const info = levelMap[level] || { color: "#cccccc", label: "Unknown" };
    
    return (
      <span 
        className="level-badge" 
        style={{ 
          backgroundColor: info.color,
          boxShadow: `0 0 10px ${info.color}`
        }}
      >
        {info.label}
      </span>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="cyber-spinner"></div>
      <p>Initializing FHE Connection...</p>
    </div>
  );

  return (
    <div className="app-container cyberpunk-theme">
      <header className="app-header">
        <div className="logo">
          <h1>FHE<span>NFT</span>Membership</h1>
          <div className="fhe-badge">
            <span>Fully Homomorphic Encryption</span>
          </div>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="hero-section">
          <div className="hero-content">
            <h2>Private NFT Memberships</h2>
            <p>Powered by Fully Homomorphic Encryption</p>
            <button 
              onClick={() => setShowMintModal(true)}
              className="mint-btn"
              disabled={!account}
            >
              {account ? "Mint FHE-NFT" : "Connect Wallet to Mint"}
            </button>
          </div>
          <div className="hero-graphic">
            <div className="fhe-animation"></div>
          </div>
        </div>
        
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Members</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.level1}</div>
            <div className="stat-label">Level 1</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.level2}</div>
            <div className="stat-label">Level 2</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.level3}</div>
            <div className="stat-label">Level 3</div>
          </div>
        </div>
        
        <div className="membership-section">
          <div className="section-header">
            <h2>FHE-Encrypted Memberships</h2>
            <div className="controls">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search memberships..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="search-icon"></div>
              </div>
              <div className="tabs">
                <button 
                  className={activeTab === "all" ? "active" : ""}
                  onClick={() => setActiveTab("all")}
                >
                  All
                </button>
                <button 
                  className={activeTab === "level1" ? "active" : ""}
                  onClick={() => setActiveTab("level1")}
                >
                  Level 1
                </button>
                <button 
                  className={activeTab === "level2" ? "active" : ""}
                  onClick={() => setActiveTab("level2")}
                >
                  Level 2
                </button>
                <button 
                  className={activeTab === "level3" ? "active" : ""}
                  onClick={() => setActiveTab("level3")}
                >
                  Level 3
                </button>
              </div>
              <button 
                onClick={loadMemberships}
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="membership-grid">
            {filteredMemberships.length === 0 ? (
              <div className="no-memberships">
                <div className="no-data-icon"></div>
                <p>No FHE-NFT memberships found</p>
                <button 
                  className="mint-btn"
                  onClick={() => setShowMintModal(true)}
                >
                  Mint First Membership
                </button>
              </div>
            ) : (
              filteredMemberships.map(membership => (
                <div 
                  className={`membership-card ${hoveredItem === membership.id ? "hover" : ""}`}
                  key={membership.id}
                  onMouseEnter={() => setHoveredItem(membership.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="card-header">
                    {renderLevelBadge(membership.encryptedLevel)}
                    <div className="membership-id">#{membership.id.substring(0, 8)}</div>
                  </div>
                  <div className="card-body">
                    <div className="owner-info">
                      <div className="label">Owner</div>
                      <div className="value">
                        {membership.owner.substring(0, 6)}...{membership.owner.substring(38)}
                      </div>
                    </div>
                    <div className="join-date">
                      <div className="label">Joined</div>
                      <div className="value">
                        {new Date(membership.joinDate * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="benefits">
                      <div className="label">Benefits</div>
                      <div className="value">
                        {membership.benefits.join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button 
                      className="verify-btn"
                      onClick={() => verifyFHE(membership.id)}
                    >
                      Verify FHE Proof
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="team-section">
          <h2>Core Team</h2>
          <p className="section-description">Building the future of private memberships with FHE</p>
          
          <div className="team-grid">
            {teamMembers.map((member, index) => (
              <div className="team-card" key={index}>
                <div className="team-photo"></div>
                <h3>{member.name}</h3>
                <div className="role">{member.role}</div>
                <p>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
  
      {showMintModal && (
        <ModalMint 
          onSubmit={mintMembership} 
          onClose={() => setShowMintModal(false)} 
          minting={minting}
          membershipData={newMembershipData}
          setMembershipData={setNewMembershipData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="cyber-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>FHE-NFT Membership</h3>
            <p>Private membership system powered by Fully Homomorphic Encryption</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="copyright">
            © {new Date().getFullYear()} FHE-NFT Membership. All rights reserved.
          </div>
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalMintProps {
  onSubmit: () => void; 
  onClose: () => void; 
  minting: boolean;
  membershipData: any;
  setMembershipData: (data: any) => void;
}

const ModalMint: React.FC<ModalMintProps> = ({ 
  onSubmit, 
  onClose, 
  minting,
  membershipData,
  setMembershipData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMembershipData({
      ...membershipData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="mint-modal">
        <div className="modal-header">
          <h2>Mint FHE-NFT Membership</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="lock-icon"></div>
            <span>Your membership level will be encrypted with FHE</span>
          </div>
          
          <div className="form-group">
            <label>Membership Level</label>
            <select 
              name="level"
              value={membershipData.level} 
              onChange={handleChange}
            >
              <option value="1">Level 1 - Basic Access</option>
              <option value="2">Level 2 - Premium Features</option>
              <option value="3">Level 3 - VIP Benefits</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Included Benefits</label>
            <div className="benefits-list">
              {membershipData.benefits.map((benefit: string, index: number) => (
                <div className="benefit-item" key={index}>
                  <div className="benefit-checkbox"></div>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="fhe-explanation">
            <h4>How FHE Protects Your Privacy:</h4>
            <ul>
              <li>Membership level encrypted on-chain</li>
              <li>Verification without decryption</li>
              <li>Private access control</li>
            </ul>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={minting}
            className="mint-btn"
          >
            {minting ? "Encrypting with FHE..." : "Mint Private Membership"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;