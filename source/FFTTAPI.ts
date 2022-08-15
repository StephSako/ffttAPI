import { ApiRequest } from "./controller/ApiRequest";
import { Partie } from "./model/Partie.interface";
import crypto from "crypto";
import { Organisme } from "./model/Organisme.interface";
import { ClubFactory } from "./Service/ClubFactory.service";
import { Club } from "./model/Club.interface";
import { ClubDetails } from "./model/ClubDetails.interface";
import { Joueur } from "./model/Joueur.interface";
import { JoueurDetails } from "./model/JoueurDetails.interface";
import { Classement } from "./model/Classement.interface";
import { Historique } from "./model/Historique.interface";
import { UnvalidatedPartie } from "./model/UnvalidatedPartie.interface";
import { Equipe } from "./model/Equipe.interface";
import { EquipePoule } from "./model/EquipePoule.interface";
import { Rencontre } from "./model/Rencontre/Rencontre.interface";
import { VirtualPoints } from "./model/VirtualPoints.interface";
import { PointCalculator } from "./Service/PointCalculator.service";
import { Utils } from "./Service/Utils.service";
import { RencontreDetails } from "./model/Rencontre/RencontreDetails.interface";
import { RencontreDetailsFactory } from "./Service/RencontreDetailsFactory.service";
import { Actualite } from "./model/Actualite.interface";
import { OrganismeRaw } from "./model/Raw/OrganismeRaw.interface";
import { ClubDetailsRaw } from "./model/Raw/ClubDetailsRaw.interface";
import { JoueurRaw } from "./model/Raw/JoueurRaw.interface";
import { ClassementRaw } from "./model/Raw/ClassementRaw.interface";
import { HistoriqueRaw } from "./model/Raw/Historiqueraw.interface";
import { EquipeRaw } from "./model/Raw/EquipeRaw.interface";
import { EquipePouleRaw } from "./model/Raw/EquipePouleRaw.interface";
import { PartieRaw } from "./model/Raw/PartieRaw.interface";
import { RencontreRaw } from "./model/Raw/RencontreRaw.interface";
import { ParamsEquipe } from "./model/ParamsEquipe.interface";
import { UnvalidatedPartieRaw } from "./model/Raw/ValidatedPartieRaw.interface";

export class FFTTApi
{
    private id;
    private password;
    private apiRequest;

    // Premier jour de Juillet comptabilisation de la saison
    const PREMIER_JOUR_SAISON = 9;
    /**
     * Dates de publication des matches (on part du principe qu'il n'y aura pas de matches officiels le 30 et 31 Décembre et que la publication aura lieu le 1er Janvier ...)
     * mois => jour
     **/
    const DATES_PUBLICATION = [1 => 1, 2 => 3, 3 => 4, 4 => 6, 5 => 4, 6 => 10, 7 => this.PREMIER_JOUR_SAISON, 10 => 4, 11 => 3];

    public constructor(id: string, password: string)
    {
        this.id = id;
        this.password = crypto.createHash('md5').update(password).digest("hex");
        this.apiRequest = new ApiRequest(this.password, this.id);
    }

    public initialize()
    {
        let time = Date.now();
        let timeCrypted = crypto.createHmac("sha1", this.password).update(time).digest('hex');
        let uri = `https://apiv2.fftt.com/mobile/pxml/xml_initialisation.php?
            serie=${this.id}
            &tm=${time}
            &tmc=${timeCrypted}
            &id=${this.id}`;

        try{
            let response = this.apiRequest.send(uri);
            return response;
        }
        catch (clientException/*: ClientException*/){
            if (clientException.getResponse().getStatusCode() === 401){
                throw new InvalidCredidentials();
            }
            throw clientException;
        }
    }

    /**
     * @param string type
     * @return Organisme[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getOrganismes(type: string = "Z"): Organisme[]
    {
        if (!['Z', 'L', 'D'].includes(type)) {
            type = 'L';
        }

        let organismes = this.apiRequest.get('xml_organisme',
            {
                type: type,
            }
        )["organisme"];

        let result: Organisme[] = [];
        organismes.forEach((organisme: OrganismeRaw) => {
            result.push(new Organisme(
                organisme.libelle,
                organisme.id,
                organisme.code,
                organisme.idPere
            ));
        })

        return result;
    }

    /**
     * @param int departementId
     * @return Club[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getClubsByDepartement(departementId: number): Club[]
    {
        let data = this.apiRequest.get('xml_club_dep2',
        {
            dep: departementId,
        }).club;

        let clubFactory = new ClubFactory();
        return clubFactory.createFromArray(data);
    }

    /**
     * @param string name
     * @return Club[]
     */
    public getClubsByName(name: string): Club[]
    {
        try {
            let data = this.apiRequest.get('xml_club_b',
            {
                ville: name,
            }).club;

            data = this.wrappedArrayIfUnique(data);

            let clubFactory = new ClubFactory();
            return clubFactory.createFromArray(data);
        } catch (/*\Exception*/ e) {
            return [];
        }
    }

    /**
     * @param string clubId
     * @return ClubDetails
     * @throws ClubNotFoundException
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getClubDetails(clubId: string): ClubDetails
    {
        let clubData: ClubDetailsRaw = this.apiRequest.get('xml_club_detail',
        {
            club: clubId,
        }).club;

        if (empty(clubData.numero)) {
            throw new ClubNotFoundException(clubId);
        }
        return new ClubDetails(
            Number(clubData.numero),
            clubData.nom,
            Array.isArray(clubData.nomsalle) ? null : clubData.nomsalle,
            Array.isArray(clubData.adressesalle1) ? null : clubData.adressesalle1,
            Array.isArray(clubData.adressesalle2) ? null : clubData.adressesalle2,
            Array.isArray(clubData.adressesalle3) ? null : clubData.adressesalle3,
            Array.isArray(clubData.codepsalle) ? null : clubData.codepsalle,
            Array.isArray(clubData.villesalle) ? null : clubData.villesalle,
            Array.isArray(clubData.web) ? null : clubData.web,
            Array.isArray(clubData.nomcor) ? null : clubData.nomcor,
            Array.isArray(clubData.prenomcor) ? null : clubData.prenomcor,
            Array.isArray(clubData.mailcor) ? null : clubData.mailcor,
            Array.isArray(clubData.telcor) ? null : clubData.telcor,
            Array.isArray(clubData.latitude) ? null : Number(clubData.latitude),
            Array.isArray(clubData.longitude) ? null : Number(clubData.longitude)
        );
    }

    /**
     * @param string clubId
     * @return Joueur[]
     * @throws ClubNotFoundException
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     */
    public getJoueursByClub(clubId: string): Joueur[]
    {
        let arrayJoueurs;
        try {
            arrayJoueurs = this.apiRequest.get('xml_liste_joueur_o',
            {
                club: clubId,
            });
        } catch (e/*: NoFFTTResponseException*/) {
            throw new ClubNotFoundException(clubId);
        }

        let result: Joueur[] = [];

        arrayJoueurs.joueur.forEach((joueur: JoueurRaw) => {
            let realJoueur = new Joueur(
                joueur.licence,
                joueur.nclub,
                joueur.club,
                joueur.nom,
                joueur.prenom,
                joueur.points);
            result.push(realJoueur);
        })
        return result;
    }


    /**
     * @param string nom
     * @param string prenom
     * @return Joueur[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getJoueursByNom(nom: string, prenom: string = ""): Joueur[]
    {
        let arrayJoueurs = this.apiRequest.get('xml_liste_joueur',
        {
            nom: addslashes(Accentuation::remove(nom)),
            prenom: addslashes(Accentuation::remove(prenom)),
        }
        ).joueur;

        arrayJoueurs = this.wrappedArrayIfUnique(arrayJoueurs);

        let result: Joueur[] = [];

        arrayJoueurs.forEach((joueur: JoueurRaw) => {
            let realJoueur = new Joueur(
                joueur.licence,
                joueur.nclub,
                joueur.club,
                joueur.nom,
                joueur.prenom,
                joueur.clast);
            result.push(realJoueur);
        })
        return result;
    }

    /**
     * @param string licenceId
     * @return JoueurDetails
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws JoueurNotFound
     */
    public getJoueurDetailsByLicence(licenceId: string): JoueurDetails
    {
        let data
        try {
            data = this.apiRequest.get('xml_licence_b',
            {
                licence: licenceId
            });

            if (!data.hasOwnProperty('licence')) throw new JoueurNotFound(licenceId);
            data = data.licence;
        } catch (e /*:NoFFTTResponseException */) {
            throw new JoueurNotFound(licenceId);
        }

        let joueurDetails = new JoueurDetails(
            licenceId,
            data.nom,
            data.prenom,
            data.numclub,
            data.nomclub,
            data.sexe === 'M' ? true : false,
            data.cat,
            Number(data.initm ?? Number(data.point)),
            Number(data.point),
            Number(data.pointm ?? Number(data.point)),
            Number(data.apointm ?? Number(data.point))
        );
        return joueurDetails;
    }

    /**
     * @param string licenceId
     * @return Classement
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws JoueurNotFound
     */
    public getClassementJoueurByLicence(licenceId: string): Classement
    {
        let joueurDetails: ClassementRaw;
        try {
            joueurDetails = this.apiRequest.get('xml_joueur',
            {
                licence: licenceId
            }).joueur;
        } catch (NoFFTTResponseException e) {
            throw new JoueurNotFound(licenceId);
        }

        let classement = new Classement(
            new Date(),
            joueurDetails.point,
            joueurDetails.apoint,
            Number(joueurDetails.clast),
            Number(joueurDetails.clnat),
            Number(joueurDetails.rangreg),
            Number(joueurDetails.rangdep),
            Number(joueurDetails.valcla),
            Number(joueurDetails.valinit)
        );
        return classement;
    }

    /**
     * @param string licenceId
     * @return Historique[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws JoueurNotFound
     */
    public getHistoriqueJoueurByLicence(licenceId: string): Historique[]
    {
        let classements;
        try {
            classements = this.apiRequest.get('xml_histo_classement',
            {
                numlic: licenceId
            }).histo;
        } catch (NoFFTTResponseException e) {
            throw new JoueurNotFound(licenceId);
        }
        let result: Historique[] = [];
        classements = this.wrappedArrayIfUnique(classements);

        classements.forEach((classement: HistoriqueRaw) => {
            let splited = classement.saison.split(' ');

            let historique = new Historique(splited[1], splited[3], Number(classement.phase), Number(classement.point));
            result.push(historique);
        })

        return result;
    }

    /**
     * @param string joueurId
     * @return Partie[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     */
    // TODO Les classe VO
    public getPartiesJoueurByLicence(joueurId: string): Partie[]
    {
        let parties: Partie[];
        try {
            parties = this.apiRequest.get('xml_partie_mysql',
            {
                licence: joueurId,
            }).partie;
            parties = this.wrappedArrayIfUnique(parties);
        } catch (NoFFTTResponseException e) {
            parties = [];
        }

        let result: Partie[] = [];
        parties.forEach((partie: PartieRaw) => {
            // let nom, prenom;
            // [nom, prenom] = Utils.returnNomPrenom(partie.advnompre);
            // let realPartie = new Partie(
            //     partie.vd === "V" ? true : false,
            //     Number(partie.numjourn),
            //     DateTime.createFromFormat('d/m/Y', partie.date),
            //     Number(partie.pointres),
            //     Number(partie.coefchamp),
            //     partie.advlic,
            //     partie.advsexe === 'M' ? true : false,
            //     nom,
            //     prenom,
            //     Number(partie.advclaof)
            // );
            // result.push(realPartie);
        })

        return result;
    }

    /**
     * Détermine si la date d'un match est hors de la plage des dates définissant les matches comme validés/comptabilisés
     */
    public isNouveauMoisVirtuel(date: Date): boolean {
        try {
            let mois = date.getMonth() + 1;
            let annee = date.getFullYear();

            while (!this.DATES_PUBLICATION.hasOwnProperty(mois)) {
                if (mois == 12) {
                    mois = 1;
                    annee++;
                } else mois++;
            }
            return date.getTimestamp() >= (new Date(`${annee}/${mois}/${this.DATES_PUBLICATION[mois]}`)).getTimestamp();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * @param string joueurId
     * @return UnvalidatedPartie[]
     * @throws InvalidURIParametersException
     * @throws URIPartNotValidException
     */
    public getUnvalidatedPartiesJoueurByLicence(joueurId: string): UnvalidatedPartie[]
    {
        let validatedParties: Partie[] = this.getPartiesJoueurByLicence(joueurId);
        let allParties: any;
        try {
            allParties = this.apiRequest.get('xml_partie',
            {
                numlic: joueurId
            }).partie ?? [];
        } catch (NoFFTTResponseException e) {
            allParties = [];
        }

        let result: UnvalidatedPartie[] = [];
        try {
            allParties.forEach((partie: UnvalidatedPartieRaw) => {
                if (partie.forfait === "0") {
                    let nom: string, prenom: string;
                    [nom, prenom] = Utils.returnNomPrenom(partie.nom);

                    let found = validatedParties.filter((validatedPartie: Partie) => {
                        let datePartie = DateTime.createFromFormat('d/m/Y', partie.date);
                        
                    //     return partie.date === validatedPartie.date.format("d/m/Y")
                    //         /** Si le nom du joueur correspond bien */
                    //         && Utils.removeAccentLowerCaseRegex(nom) === Utils.removeAccentLowerCaseRegex(validatedPartie.getAdversaireNom())
                    //         /** Si le prénom du joueur correspond bien */
                    //         && (
                    //             preg_match('/' . Utils.removeAccentLowerCaseRegex(prenom) . '.*/', Utils.removeAccentLowerCaseRegex(validatedPartie.getAdversairePrenom())) or
                    //             str_contains(Utils.removeAccentLowerCaseRegex(prenom), Utils.removeAccentLowerCaseRegex(validatedPartie.getAdversairePrenom()))
                    //         )
                    //         /** Si le coefficient est renseigné */
                    //         && validatedPartie.coefficient === Number(partie.coefchamp)
                    //         /** Si le joueur n'est pas absent */
                    //         && !prenom.includes('Absent') && !nom.includes('Absent')
                    //         /** Si la partie a été réalisée durant le mois dernier ou durant le mois actuel */
                    //         && !(
                    //             validatedPartie.getPointsObtenus() === 0.0
                    //             && (
                    //                 (datePartie.format('n') === (new DateTime()).format('n')
                    //                     && datePartie.format('Y') === (new DateTime()).format('Y'))
                    //                 || (`${datePartie.getmonth() + 1}/${datePartie.getFullYear()}`) === `${date('n', strtotime('-1 month'))}/${date('Y', strtotime('-1 month'))}`
                    //             )
                    //         );
                    }).length;

                    if (found === 0) {
                        result.push(new UnvalidatedPartie(
                            partie.epreuve,
                            partie.idpartie,
                            Number(partie.coefchamp),
                            partie.victoire === "V",
                            false,
                            DateTime.createFromFormat('d/m/Y', partie.date),
                            nom,
                            prenom,
                            Utils.formatPoints(partie.classement)
                        ));
                    }
                }
            })
            return result;
        } catch (Exception e) {
            return [];
        }
    }

    /**
     * @param string joueurId
     * @return VirtualPoints Objet contenant les points gagnés/perdus et le classement virtuel du joueur
     */
    public getJoueurVirtualPoints(joueurId: string): VirtualPoints
    {
        let pointCalculator = new PointCalculator();

        try {
            let classement = this.getClassementJoueurByLicence(joueurId);
            let virtualMonthlyPointsWon = 0.0;
            let virtualMonthlyPoints = 0.0;
            let latestMonth: number | null = null;
            let monthPoints = round(classement.points, 1);
            let unvalidatedParties = this.getUnvalidatedPartiesJoueurByLicence(joueurId);

            // usort(unvalidatedParties, (UnvalidatedPartie a, UnvalidatedPartie b) {
            //     return a.getDate() >= b.getDate();
            // });

            unvalidatedParties.forEach((unvalidatedParty: UnvalidatedPartie) => {
                if (!latestMonth) {
                    latestMonth = unvalidatedParty.date.getMonth() + 1;
                } else {
                    if (latestMonth != (unvalidatedParty.date.getMonth() + 1) && this.isNouveauMoisVirtuel(unvalidatedParty.date)) {
                        monthPoints = round(classement.points + virtualMonthlyPointsWon, 1);
                        latestMonth = unvalidatedParty.date.getMonth() + 1;
                    }
                }

                let coeff: number = unvalidatedParty.coefficientChampionnat;

                if (!unvalidatedParty.isForfait) {
                    let adversairePoints: number = unvalidatedParty.adversaireClassement;

                    try {
                        let availableJoueurs = this.getJoueursByNom(unvalidatedParty.adversaireNom, unvalidatedParty.adversairePrenom);
                        availableJoueurs.forEach((availableJoueur: any) => {
                            if (round((unvalidatedParty.adversaireClassement / 100)) == availableJoueur.points) {
                                let classementJoueur: Classement = this.getClassementJoueurByLicence(availableJoueur.licence);
                                adversairePoints = round(classementJoueur.points, 1);
                                break;
                            }
                        })
                    } catch (/*NoFFTTResponseException*/ e) {
                        adversairePoints = unvalidatedParty.adversaireClassement;
                    }
                    // catch (/*InvalidURIParametersException*/ e) {
                    //     adversairePoints = unvalidatedParty.adversaireClassement;
                    // }

                    let points: number = unvalidatedParty.isVictoire
                        ? pointCalculator.getPointVictory(monthPoints, Number(adversairePoints))
                        : pointCalculator.getPointDefeat(monthPoints, Number(adversairePoints));
                    virtualMonthlyPointsWon += points * coeff;
                }
            })

            virtualMonthlyPoints = monthPoints + virtualMonthlyPointsWon;
            return new VirtualPoints(
                virtualMonthlyPointsWon,
                virtualMonthlyPoints,
                virtualMonthlyPoints - classement.pointsInitials
            );
        } catch (/*JoueurNotFound*/ e) {
            return new VirtualPoints(0.0, this.getJoueurDetailsByLicence(joueurId).pointsLicence, 0.0);
        }
    }

    /**
     * @param string joueurId
     * @return number points mensuels gagnés ou perdus en fonction des points mensuels de l'adversaire
     */
    public getVirtualPoints(joueurId: string): number {
        return this.getJoueurVirtualPoints(joueurId).monthlyPointsWon;
    }

    /**
     * @param string clubId
     * @param string|null type
     * @return Equipe[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getEquipesByClub(clubId: string, type: string | null = null): Equipe[]
    {
        let params: ParamsEquipe = {
            numclu: clubId
        };

        if (type) params.type = type;

        if (this.apiRequest.get('xml_equipe', params) == []) return [];
        let data = this.apiRequest.get('xml_equipe', params).equipe;
        data = this.wrappedArrayIfUnique(data);

        let result: Equipe[] = [];
        data.forEach((dataEquipe: EquipeRaw) => {
            result.push(new Equipe(
                dataEquipe.libequipe,
                dataEquipe.libdivision,
                dataEquipe.liendivision
            ));
        })
        return result;
    }

    /**
     * @param string lienDivision
     * @return EquipePoule[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getClassementPouleByLienDivision(lienDivision: string): EquipePoule[]
    {
        let data: EquipePouleRaw[] = this.apiRequest.get('xml_result_equ', { action: 'classement' }, lienDivision).classement;
        let result: EquipePoule[] = [];
        let lastClassment = 0;
        data.forEach((equipePouleData: EquipePouleRaw) => {

            if (!is_string(equipePouleData.equipe)) {
                break;
            }

            result.push(new EquipePoule(
                equipePouleData.clt === '-' ? lastClassment : Number(equipePouleData.clt),
                equipePouleData.equipe,
                Number(equipePouleData.joue),
                Number(equipePouleData.pts),
                equipePouleData.numero,
                Number(equipePouleData.totvic),
                Number(equipePouleData.totdef),
                Number(equipePouleData.idequipe),
                equipePouleData.idclub
            ));
            lastClassment = equipePouleData.clt === '-' ? lastClassment : Number(equipePouleData.clt);
        })
        return result;
    }

    /**
     * @param string lienDivision
     * @return Rencontre[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getRencontrePouleByLienDivision(lienDivision: string): Rencontre[]
    {
        let data = this.apiRequest.get('xml_result_equ', {}, lienDivision).tour;

        let result: Rencontre[] = [];
        data.forEach((dataRencontre: RencontreRaw) => {
            let equipeA = dataRencontre.equa;
            let equipeB = dataRencontre.equb;

            result.push(new Rencontre(
                dataRencontre.libelle,
                Array.isArray(equipeA) ? '': equipeA,
                Array.isArray(equipeB) ? '': equipeB,
                Number(dataRencontre.scorea),
                Number(dataRencontre.scoreb),
                dataRencontre.lien,
                DateTime.createFromFormat('d/m/Y', dataRencontre.dateprevue),
                empty(dataRencontre.datereelle) ? null : DateTime::createFromFormat('d/m/Y', dataRencontre.datereelle)
            ));
        })
        return result;
    }


    /**
     * @param Equipe equipe
     * @return Rencontre[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getProchainesRencontresEquipe(equipe: Equipe): Rencontre[]
    {
        let nomEquipe = Utils.extractNomEquipe(equipe);
        let rencontres = this.getRencontrePouleByLienDivision(equipe.lienDivision);

        let prochainesRencontres: Rencontre[] = [];
        rencontres.forEach((rencontre: Rencontre) => {
            if (!rencontre.dateReelle && rencontre.nomEquipeA === nomEquipe || rencontre.nomEquipeB === nomEquipe) {
                prochainesRencontres.push(rencontre);
            }
        })
        return prochainesRencontres;
    }

    /**
     * @param Equipe equipe
     * @return ClubDetails|null
     * @throws ClubNotFoundException
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getClubEquipe(equipe: Equipe): ?ClubDetails
    {
        let nomEquipe = Utils.extractClub(equipe);
        let club: Club[] = this.getClubsByName(nomEquipe);

        return club.length === 1 ? this.getClubDetails(club[0].numero) : null;
    }

    /**
     * @param string lienRencontre
     * @param string clubEquipeA
     * @param string clubEquipeB
     * @return RencontreDetails
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws InvalidLienRencontre
     * @throws NoFFTTResponseException
     */
    public getDetailsRencontreByLien(lienRencontre: string, clubEquipeA: string = "", clubEquipeB: string = ""): RencontreDetails
    {
        let data = this.apiRequest.get('xml_chp_renc', {}, lienRencontre);
        
        if (!(isset(data.resultat) && isset(data.joueur) && isset(data.partie))) {
            throw new InvalidLienRencontre(lienRencontre);
        }

        let factory = new RencontreDetailsFactory(this);
        return factory.createFromArray(data, clubEquipeA, clubEquipeB);
    }

    /**
     * @return Actualite[]
     * @throws Exception\InvalidURIParametersException
     * @throws Exception\URIPartNotValidException
     * @throws NoFFTTResponseException
     */
    public getActualites(): Actualite[]
    {
        let data = this.apiRequest.get('xml_new_actu').news;
        data = this.wrappedArrayIfUnique(data);

        let result: Actualite[] = [];
        data.foreach((dataActualite: Actualite) => {
            result[] = new Actualite(
                DateTime::createFromFormat('Y-m-d', dataActualite.date),
                dataActualite.titre,
                dataActualite.description,
                dataActualite.url,
                dataActualite.photo,
                dataActualite.categorie
            );
        })
        return result;
    }

    /**
     * @param array 
     * @returns 
     */
    private wrappedArrayIfUnique(array: Partie[]):  Partie[]
    {
        if (array.length == count(array, COUNT_RECURSIVE)) {
            return [array];
        }
        return array;
    }
}