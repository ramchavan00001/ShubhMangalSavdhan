/**
 * Seeds dropdown master data and the admin account(s).
 * `SEED_DEMO=true npm run db:seed` also adds demo profiles for local testing (never in production).
 */
import { existsSync } from 'node:fs';
import { Diet, FamilyType, FamilyValues, Gender, MasterType, MaritalStatus, PrismaClient } from '@prisma/client';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaClient();

const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Parsi', 'Jewish', 'No religion', 'Other'];

const COMMUNITIES: Record<string, string[]> = {
  Hindu: [
    'Maratha', 'Brahmin', 'Deshastha Brahmin', 'Kokanastha Brahmin', 'CKP', 'Kunbi', 'Mali', 'Dhangar', 'Agri', 'Koli',
    'Bhandari', 'Teli', 'Sonar', 'Lingayat', 'Vanjari', 'Rajput', 'Kshatriya', 'Kayastha', 'Baniya', 'Agarwal',
    'Maheshwari', 'Patel', 'Lohana', 'Jat', 'Yadav', 'Kurmi', 'Gupta', 'Nair', 'Ezhava', 'Iyer', 'Iyengar', 'Reddy',
    'Kamma', 'Kapu', 'Naidu', 'Vokkaliga', 'Bunt', 'Gounder', 'Mudaliar', 'Pillai', 'Nadar', 'Chettiar', 'Arora',
    'Khatri', 'Bengali Kayastha', 'Scheduled Caste', 'Scheduled Tribe', 'Other',
  ],
  Muslim: ['Sunni', 'Shia', 'Bohra', 'Khoja', 'Memon', 'Pathan', 'Syed', 'Ansari', 'Qureshi', 'Other'],
  Christian: ['Catholic', 'Protestant', 'Orthodox', 'Syrian Christian', 'Born Again', 'Pentecostal', 'Other'],
  Sikh: ['Jat Sikh', 'Khatri Sikh', 'Ramgarhia', 'Arora Sikh', 'Saini', 'Other'],
  Jain: ['Digambar', 'Shwetambar', 'Oswal', 'Porwal', 'Other'],
  Buddhist: ['Navayana', 'Mahayana', 'Theravada', 'Other'],
  Parsi: ['Parsi', 'Irani'],
  Jewish: ['Bene Israel', 'Baghdadi', 'Cochin', 'Other'],
  'No religion': ['Not applicable'],
  Other: ['Other'],
};

const MOTHER_TONGUES = [
  'Marathi', 'Hindi', 'Gujarati', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Odia', 'Konkani',
  'Urdu', 'Sindhi', 'Assamese', 'Marwari', 'Rajasthani', 'Bhojpuri', 'Tulu', 'Kashmiri', 'English', 'Other',
];

const EDUCATIONS = [
  'High school', 'Diploma', 'B.A.', 'B.Com', 'B.Sc', 'BBA', 'BCA', 'B.E. / B.Tech', 'B.Arch', 'B.Pharm', 'LLB', 'MBBS',
  'BDS', 'BAMS / BHMS', 'B.Ed', 'CA', 'CS', 'ICWA / CMA', 'M.A.', 'M.Com', 'M.Sc', 'MBA / PGDM', 'MCA', 'M.E. / M.Tech',
  'LLM', 'MD / MS', 'M.Pharm', 'PhD', 'Other',
];

const PROFESSIONS = [
  'Software Engineer', 'IT Professional', 'Engineer', 'Doctor', 'Dentist', 'Nurse', 'Pharmacist', 'Chartered Accountant',
  'Banking Professional', 'Finance Professional', 'Lawyer', 'Teacher', 'Professor', 'Government Employee',
  'Civil Services (IAS/IPS)', 'Defence', 'Police', 'Business Owner', 'Entrepreneur', 'Manager', 'Product Manager',
  'Designer', 'Architect', 'Sales & Marketing', 'HR Professional', 'Consultant', 'Scientist / Researcher', 'Pilot',
  'Media & Journalism', 'Farmer / Agriculture', 'Homemaker', 'Student', 'Not working', 'Other',
];

const INCOMES = [
  'No income', 'Up to ₹3 lakh', '₹3–5 lakh', '₹5–7 lakh', '₹7–10 lakh', '₹10–15 lakh', '₹15–20 lakh', '₹20–30 lakh',
  '₹30–50 lakh', '₹50 lakh–1 crore', 'Above ₹1 crore', 'Prefer not to say',
];

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry', 'Outside India',
];

async function upsertList(type: MasterType, values: string[]) {
  for (const [i, value] of values.entries()) {
    await prisma.masterItem.upsert({
      where: { type_value: { type, value } },
      create: { type, value, sortOrder: i },
      update: {},
    });
  }
}

async function seedMasters() {
  await upsertList('RELIGION', RELIGIONS);
  for (const [religion, list] of Object.entries(COMMUNITIES)) {
    for (const [i, value] of list.entries()) {
      // Community names like "Other" repeat across religions, so the stored value is unique per religion.
      const stored = value === 'Other' || value === 'Not applicable' ? `${value} (${religion})` : value;
      await prisma.masterItem.upsert({
        where: { type_value: { type: 'COMMUNITY', value: stored } },
        create: { type: 'COMMUNITY', value: stored, parent: religion, sortOrder: i },
        update: {},
      });
    }
  }
  await upsertList('MOTHER_TONGUE', MOTHER_TONGUES);
  await upsertList('EDUCATION', EDUCATIONS);
  await upsertList('PROFESSION', PROFESSIONS);
  await upsertList('INCOME', INCOMES);
  await upsertList('STATE', STATES);
}

async function seedAdmins() {
  const phones = (process.env.ADMIN_PHONES ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  for (const phone of phones) {
    await prisma.user.upsert({
      where: { phone },
      create: { phone, role: 'ADMIN', profile: { create: {} } },
      update: { role: 'ADMIN' },
    });
  }
  return phones;
}

/** Fictional demo members so the site isn't empty while developing. */
async function seedDemo() {
  const demo: Array<{
    phone: string; firstName: string; lastName: string; gender: Gender; dob: string; heightCm: number;
    religion: string; community: string; motherTongue: string; state: string; city: string;
    education: string; profession: string; income: string; diet: Diet;
  }> = [
    { phone: '919000000001', firstName: 'Priya', lastName: 'Kulkarni', gender: 'FEMALE', dob: '1999-04-12', heightCm: 163, religion: 'Hindu', community: 'Deshastha Brahmin', motherTongue: 'Marathi', state: 'Maharashtra', city: 'Pune', education: 'B.E. / B.Tech', profession: 'Software Engineer', income: '₹10–15 lakh', diet: 'VEG' },
    { phone: '919000000002', firstName: 'Sneha', lastName: 'Patil', gender: 'FEMALE', dob: '2000-08-03', heightCm: 158, religion: 'Hindu', community: 'Maratha', motherTongue: 'Marathi', state: 'Maharashtra', city: 'Mumbai', education: 'MBBS', profession: 'Doctor', income: '₹7–10 lakh', diet: 'NON_VEG' },
    { phone: '919000000003', firstName: 'Anjali', lastName: 'Deshmukh', gender: 'FEMALE', dob: '1998-01-21', heightCm: 165, religion: 'Hindu', community: 'Maratha', motherTongue: 'Marathi', state: 'Maharashtra', city: 'Nashik', education: 'CA', profession: 'Chartered Accountant', income: '₹15–20 lakh', diet: 'VEG' },
    { phone: '919000000004', firstName: 'Meera', lastName: 'Raman', gender: 'FEMALE', dob: '2000-11-30', heightCm: 160, religion: 'Hindu', community: 'Iyer', motherTongue: 'Tamil', state: 'Tamil Nadu', city: 'Chennai', education: 'MBBS', profession: 'Doctor', income: '₹10–15 lakh', diet: 'VEG' },
    { phone: '919000000011', firstName: 'Aditya', lastName: 'Shah', gender: 'MALE', dob: '1996-02-17', heightCm: 178, religion: 'Hindu', community: 'Patel', motherTongue: 'Gujarati', state: 'Maharashtra', city: 'Mumbai', education: 'CA', profession: 'Chartered Accountant', income: '₹20–30 lakh', diet: 'VEG' },
    { phone: '919000000012', firstName: 'Rahul', lastName: 'Jadhav', gender: 'MALE', dob: '1997-06-09', heightCm: 175, religion: 'Hindu', community: 'Maratha', motherTongue: 'Marathi', state: 'Maharashtra', city: 'Pune', education: 'B.E. / B.Tech', profession: 'Software Engineer', income: '₹15–20 lakh', diet: 'NON_VEG' },
    { phone: '919000000013', firstName: 'Harpreet', lastName: 'Singh', gender: 'MALE', dob: '1997-09-25', heightCm: 183, religion: 'Sikh', community: 'Jat Sikh', motherTongue: 'Punjabi', state: 'Delhi', city: 'Delhi', education: 'MBA / PGDM', profession: 'Product Manager', income: '₹30–50 lakh', diet: 'NON_VEG' },
    { phone: '919000000014', firstName: 'Omkar', lastName: 'Joshi', gender: 'MALE', dob: '1995-12-01', heightCm: 172, religion: 'Hindu', community: 'Kokanastha Brahmin', motherTongue: 'Marathi', state: 'Maharashtra', city: 'Pune', education: 'M.E. / M.Tech', profession: 'Engineer', income: '₹10–15 lakh', diet: 'VEG' },
  ];

  for (const d of demo) {
    const exists = await prisma.user.findUnique({ where: { phone: d.phone } });
    if (exists) continue;
    await prisma.user.create({
      data: {
        phone: d.phone,
        profile: {
          create: {
            createdFor: 'SELF',
            firstName: d.firstName,
            lastName: d.lastName,
            gender: d.gender,
            dateOfBirth: new Date(d.dob),
            heightCm: d.heightCm,
            maritalStatus: MaritalStatus.NEVER_MARRIED,
            religion: d.religion,
            community: d.community,
            motherTongue: d.motherTongue,
            country: 'India',
            state: d.state,
            city: d.city,
            citizenship: 'India',
            education: d.education,
            profession: d.profession,
            annualIncome: d.income,
            fatherOccupation: 'Retired',
            motherOccupation: 'Homemaker',
            brothers: 1,
            sisters: 0,
            familyType: FamilyType.NUCLEAR,
            familyValues: FamilyValues.MODERATE,
            diet: d.diet,
            smoking: 'NO',
            drinking: 'NO',
            aboutMe: `[Demo profile] ${d.firstName} works as a ${d.profession.toLowerCase()} in ${d.city} and enjoys travel, music and time with family.`,
            onboardingStep: 8,
            status: 'APPROVED',
            approvedAt: new Date(),
          },
        },
      },
    });
  }
  return demo.length;
}

async function main() {
  await seedMasters();
  const admins = await seedAdmins();
  console.log(`Seeded master data. Admin phones: ${admins.join(', ') || '(none — set ADMIN_PHONES)'}`);
  if (process.env.SEED_DEMO === 'true') {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo profiles in production');
    console.log(`Seeded ${await seedDemo()} demo profiles (phones 9190000000xx).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
