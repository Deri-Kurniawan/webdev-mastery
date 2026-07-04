import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DerizerModule", (m) => {
  const derizer = m.contract("Derizer");

  return { derizer };
});