#!/usr/bin/env node
/**
 * Build Stack User to Domain Mappings from existing data
 *
 * This script combines package data with Stack User info to create
 * a comprehensive mapping of which domains belong to which Stack Users.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// StackCP Users from web interface with their primary domains (used for matching)
const STACKCP_USERS = [
  { id: '2023322', name: 'Astrid Ingram-Brooke', email: 'astrid@inghambrooke.com', primaryDomain: null },
  { id: '2023296', name: 'Craig Niblock', email: 'craig@silverboltsystems.com', primaryDomain: 'silverboltsystems.com' },
  { id: '911901', name: 'Debbie Tomlinson', email: 'debbie@aawadmin.co.uk', primaryDomain: 'aawadmin.co.uk' },
  { id: '2022864', name: 'Edward Burns', email: 'edward@advocate-art.com', primaryDomain: 'advocate-art.com' },
  { id: '2023346', name: 'Farook Owadally', email: 'farook@oandk.co.uk', primaryDomain: 'oandk.co.uk' },
  { id: '3803106', name: 'Joanne Element', email: 'joanne.element@gmail.com', primaryDomain: 'thesuccesselement.com' },
  { id: '1773562', name: 'Jonathon Northcott', email: 'jon@havocdesigns.co.uk', primaryDomain: 'havoccreate.co.uk' },
  { id: '2023316', name: 'Luke Erhlanderr', email: 'lukeerhlanderr@gmail.com', primaryDomain: 'erhlanderr.uk' },
  { id: '2023290', name: 'Mark Butcher', email: 'mark.butcher@abacusproperty-solutions.co.uk', primaryDomain: 'abacusproperty-solutions.co.uk' },
  { id: '4773007', name: 'Martin Dearlove', email: 'Martindearlove@yahoo.co.uk', primaryDomain: 'topbrassminis.co.uk' },
  { id: '2023268', name: 'Martin Horswood', email: 'martin@allyourcomputers.co.uk', primaryDomain: 'allyourcomputers.co.uk' },
  { id: '4833503', name: 'Naomi Smith', email: 'nsmith@rosekirk.co.uk', primaryDomain: 'rosekirk.co.uk' },
  { id: '2023386', name: 'Nicola Jesty', email: 'nicolajesty@me.com', primaryDomain: null },
  { id: '2023284', name: 'Rachel Annette', email: 'rachel.j.annette@hotmail.co.uk', primaryDomain: 'honeybeehappy.co.uk' },
  { id: '920199', name: 'Ross MacLennan', email: 'ross@freelance.email', primaryDomain: 'maclennanphotography.com' },
  { id: '4606664', name: 'Sarah Jones', email: 'sarah@money-pad.co.uk', primaryDomain: null },
  { id: '2857296', name: 'Shamal Samal', email: 'shamal.samal@googlemail.com', primaryDomain: null },
  { id: '2023274', name: 'Toby Smith', email: 'voysey3@hotmail.com', primaryDomain: 'thewildhighlander.com' },
  { id: '912727', name: 'Trish Bayliss', email: 'trish.bayliss@btinternet.com', primaryDomain: null },
  { id: '1017975', name: 'Zee Ahmed', email: 'zee@ammcore.com', primaryDomain: null },
];

// Hosting packages from 20i API with their Stack User refs
const HOSTING_PACKAGES = [
  { id: 420513, name: 'surreyandbucksbusinesscentres.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:3205128', isWordpress: false },
  { id: 741209, name: 'austininventories.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907585', isWordpress: false },
  { id: 741211, name: 'victoriachiropractic.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907587', isWordpress: false },
  { id: 741213, name: 'havoccreate.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907589', isWordpress: false },
  { id: 741217, name: 'homecountiesbusinesscentres.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907593', isWordpress: false },
  { id: 741219, name: 'homecountiesland.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907595', isWordpress: false },
  { id: 741221, name: 'aawadmin.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907597', isWordpress: false },
  { id: 741227, name: 'surreyandbucksantiques.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907603', isWordpress: false },
  { id: 741229, name: 'elmbridgeestates.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907605', isWordpress: false },
  { id: 741303, name: 'allyourcomputers.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:907713', isWordpress: false },
  { id: 741965, name: 'allyourhosting.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:909041', isWordpress: false },
  { id: 796277, name: 'ayc365.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:988033', isWordpress: false },
  { id: 844487, name: 'abacusproperty-solutions.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:1058175', isWordpress: false },
  { id: 875745, name: 'schematherapygb.com', type: 'Linux Unlimited', stackUserRef: 'stack-user:1100351', isWordpress: false },
  { id: 875747, name: 'oandk.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:1100353', isWordpress: false },
  { id: 915201, name: 'pressfileprint.com', type: 'Linux Unlimited', stackUserRef: 'stack-user:1156481', isWordpress: false },
  { id: 916413, name: 'erhlanderr.uk', type: 'SMB Hosting', stackUserRef: 'stack-user:1158329', isWordpress: false },
  { id: 916439, name: 'maclennanphotography.com', type: 'Linux Unlimited', stackUserRef: 'stack-user:1158371', isWordpress: false },
  { id: 916455, name: 'thewildhighlander.com', type: 'Linux Unlimited', stackUserRef: 'stack-user:1158403', isWordpress: false },
  { id: 916465, name: 'twhblog.com', type: 'Linux Unlimited', stackUserRef: 'stack-user:1158417', isWordpress: false },
  { id: 1006121, name: 'ayc-demo.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:1290875', isWordpress: true },
  { id: 1317914, name: 'honeybeehappy.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:1739430', isWordpress: true },
  { id: 1361914, name: 'havenbridge.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:1800422', isWordpress: true },
  { id: 1384388, name: 'creativtribe.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:1831538', isWordpress: true },
  { id: 1628020, name: 'medical-accountants.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:2199638', isWordpress: true },
  { id: 1674450, name: 'jardines.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:2265092', isWordpress: true },
  { id: 1755720, name: 'sh-ac.org.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:2378570', isWordpress: true },
  { id: 1767724, name: 'sh-ac-office.org.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:2395940', isWordpress: false },
  { id: 2097030, name: 'elitespecialistsupportservices.co.uk', type: 'WordPress Unlimited', stackUserRef: 'stack-user:2863796', isWordpress: true },
  { id: 2516478, name: 'rosekirk.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:3618878', isWordpress: false },
  { id: 2610116, name: 'thesuccesselement.com', type: 'WordPress Unlimited', stackUserRef: 'stack-user:3803074', isWordpress: true },
  { id: 3282575, name: 'topbrassminis.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:4773009', isWordpress: false },
  { id: 3514269, name: 'allyourdesktops.co.uk', type: 'Linux Unlimited', stackUserRef: 'stack-user:5089523', isWordpress: false },
];

// Manual mapping: Package domain -> StackCP User (based on email/primary domain match)
const DOMAIN_TO_STACKCP_USER = {
  'aawadmin.co.uk': '911901',           // Debbie Tomlinson
  'allyourcomputers.co.uk': '2023268',  // Martin Horswood
  'allyourhosting.co.uk': '2023268',    // Martin Horswood (same person, different stack-user ref)
  'ayc365.co.uk': '2023268',            // Martin Horswood
  'ayc-demo.co.uk': '2023268',          // Martin Horswood
  'allyourdesktops.co.uk': '2023268',   // Martin Horswood
  'abacusproperty-solutions.co.uk': '2023290', // Mark Butcher
  'oandk.co.uk': '2023346',             // Farook Owadally
  'erhlanderr.uk': '2023316',           // Luke Erhlanderr
  'maclennanphotography.com': '920199', // Ross MacLennan
  'thewildhighlander.com': '2023274',   // Toby Smith
  'twhblog.com': '2023274',             // Toby Smith
  'honeybeehappy.co.uk': '2023284',     // Rachel Annette
  'thesuccesselement.com': '3803106',   // Joanne Element
  'rosekirk.co.uk': '4833503',          // Naomi Smith
  'topbrassminis.co.uk': '4773007',     // Martin Dearlove
  'havoccreate.co.uk': '1773562',       // Jonathon Northcott
};

// Edward Burns' 50 domains
const EDWARD_BURNS_DOMAINS = [
  'accountsadmin.co.uk', 'accountsadmin.com', 'advocate-art.agency', 'advocate-art.co.uk',
  'advocate-art.com', 'advocate-art.uk', 'advocate-illustration.co.uk', 'advocate-illustration.com',
  'advocate-illustration.uk', 'advocateart.agency', 'advocateart.co.uk', 'advocateart.com',
  'advocateart.uk', 'art-advocate.co.uk', 'art-advocate.com', 'art-advocate.uk',
  'artistique-ai.com', 'artistique-int.com', 'artistique-int.london', 'artistportal.info',
  'astound.us', 'brightagency.co.uk', 'carolinewakeman.com', 'carolinewakemanwriter.com',
  'childrensbookillustrators.com', 'collaborate.agency', 'collaborateagency.co.uk', 'collaborateagency.com',
  'eandcburns.com', 'edmyer.co.uk', 'edmyer.com', 'edmyer.uk',
  'illo.agency', 'illoagency.com', 'illustration-agency.co.uk', 'itsme.biz',
  'itsmegroup.com', 'itsmelimited.com', 'phonejoan.co.uk', 'plumpudding-illustration.co.uk',
  'plumpudding-illustration.com', 'thebrightagencies.co.uk', 'thebrightagencies.com', 'theoburns.co.uk',
  'theoburns.com', 'verityfairy.co.uk', 'verityfairy.com', 'yeonagency.com',
  'artist-ai.com', 'artiqnft.com'
];

// Martin Horswood's domains (from web scraping)
const MARTIN_HORSWOOD_DOMAINS = [
  'allyourcomputers.co.uk', 'allyourcomputers.com', 'allyourdesktops.co.uk', 'allyourdesktops.com',
  'allyoursoftware.co.uk', 'allyourutilities.co.uk', 'ayc-demo.co.uk', 'ayc365.co.uk',
  'allyour3dprinting.co.uk', 'allyour3dprinting.com', 'allyouraicoding.co.uk', 'allyouraicoding.com',
  'allyourai.co.uk', 'allyourhosting.co.uk'
];

async function buildMappings() {
  console.log('='.repeat(60));
  console.log('Building Stack User to Domain Mappings');
  console.log('='.repeat(60));

  const mappings = [];

  // 1. Create mappings from hosting packages
  console.log('\n1. Processing hosting packages...');
  for (const pkg of HOSTING_PACKAGES) {
    // Look up the StackCP User ID for this domain
    let stackCpUserId = DOMAIN_TO_STACKCP_USER[pkg.name];

    // If not in our manual mapping, try to find by primary domain
    if (!stackCpUserId) {
      const user = STACKCP_USERS.find(u => u.primaryDomain === pkg.name);
      if (user) stackCpUserId = user.id;
    }

    const stackUser = STACKCP_USERS.find(u => u.id === stackCpUserId);

    mappings.push({
      stack_user_id: stackCpUserId || pkg.stackUserRef.replace('stack-user:', ''),
      stack_user_ref: pkg.stackUserRef,
      domain_name: pkg.name,
      package_id: pkg.id,
      package_name: pkg.name,
      package_type: pkg.type,
      is_wordpress: pkg.isWordpress,
      is_enabled: true
    });
  }
  console.log(`   Added ${mappings.length} package-based mappings`);

  // 2. Add Edward Burns' domain-only assignments
  console.log('\n2. Adding Edward Burns domain-only assignments...');
  const edwardBurns = STACKCP_USERS.find(u => u.name === 'Edward Burns');
  const existingDomains = new Set(mappings.map(m => m.domain_name));

  for (const domain of EDWARD_BURNS_DOMAINS) {
    if (!existingDomains.has(domain)) {
      mappings.push({
        stack_user_id: edwardBurns.id,
        stack_user_ref: `stack-user:${edwardBurns.id}`,
        domain_name: domain,
        package_id: null,
        package_name: null,
        package_type: 'Domain',
        is_wordpress: false,
        is_enabled: true
      });
    }
  }

  // 3. Add Martin Horswood's domain-only assignments
  console.log('3. Adding Martin Horswood domain-only assignments...');
  const martinHorswood = STACKCP_USERS.find(u => u.name === 'Martin Horswood');
  const mhExistingDomains = new Set(mappings
    .filter(m => m.stack_user_id === martinHorswood.id)
    .map(m => m.domain_name));

  for (const domain of MARTIN_HORSWOOD_DOMAINS) {
    if (!mhExistingDomains.has(domain)) {
      mappings.push({
        stack_user_id: martinHorswood.id,
        stack_user_ref: `stack-user:${martinHorswood.id}`,
        domain_name: domain,
        package_id: null,
        package_name: null,
        package_type: 'Domain',
        is_wordpress: false,
        is_enabled: true
      });
    }
  }

  return mappings;
}

async function saveToSupabase(mappings) {
  console.log('\n' + '='.repeat(60));
  console.log('Saving to Supabase...');
  console.log('='.repeat(60));

  // Clear existing data
  console.log('Clearing existing mappings...');
  await supabase.from('stack_user_domain_mappings').delete().neq('stack_user_id', '0');

  // Insert in batches (without is_domain_only column)
  console.log(`Inserting ${mappings.length} mappings...`);
  const batchSize = 50;
  let successCount = 0;

  for (let i = 0; i < mappings.length; i += batchSize) {
    const batch = mappings.slice(i, i + batchSize);
    const { error } = await supabase.from('stack_user_domain_mappings').insert(batch);

    if (error) {
      console.error(`Error batch ${Math.floor(i / batchSize) + 1}:`, error.message);
    } else {
      successCount += batch.length;
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(mappings.length / batchSize)}`);
    }
  }

  console.log(`Successfully inserted ${successCount}/${mappings.length} mappings`);
}

async function main() {
  try {
    const mappings = await buildMappings();

    // Summary by user
    console.log('\n' + '='.repeat(60));
    console.log('Summary by Stack User');
    console.log('='.repeat(60));

    const byUser = {};
    for (const m of mappings) {
      const user = STACKCP_USERS.find(u => u.id === m.stack_user_id);
      const displayName = user ? user.name : `Unknown (${m.stack_user_ref})`;
      if (!byUser[displayName]) {
        byUser[displayName] = [];
      }
      byUser[displayName].push(m.domain_name);
    }

    for (const [name, domains] of Object.entries(byUser).sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`\n${name} (${domains.length} domains):`);
      domains.slice(0, 5).forEach(d => console.log(`  - ${d}`));
      if (domains.length > 5) console.log(`  ... and ${domains.length - 5} more`);
    }

    // Save to file
    fs.writeFileSync('/tmp/complete_stack_user_mappings.json', JSON.stringify(mappings, null, 2));
    console.log('\n\nSaved to /tmp/complete_stack_user_mappings.json');

    // Save to Supabase
    await saveToSupabase(mappings);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
